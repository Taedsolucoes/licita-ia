import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CapagService } from '../capag/capag.service';

// ─── Interfaces: Extraction Calls ────────────────────────────────────────────

export interface ExtractedBasicInfo {
  numero_pregao: string | null;
  numero_uasg: string | null;
  nome_orgao: string | null;
  esfera: 'municipal' | 'estadual' | 'federal' | null;
  municipio: string | null;
  uf: string | null;
  data_licitacao: string | null;
  hora_licitacao: string | null;
  objeto: string | null;
  vigencia_contratacao: string | null;
  valor_estimado: string | null;
  garantia_contratual: { exige: boolean; percentual: string | null } | null;
  garantia_objeto: { exige: boolean; descricao: string | null } | null;
  local_execucao: string | null;
  locais_entrega: Array<{ endereco_completo: string; cidade_uf: string }>;
  pagamento: { prazo: string; forma: string; detalhes: string } | null;
  especificacao_servico: string | null;
  items_licitacao: Array<{
    item_number: number | string;
    codigo: string | null;
    descricao: string;
    quantidade: number | string;
    unidade: string;
    valor_unitario: string | null;
    valor_total: string | null;
  }>;
}

export interface ExtractedHabilitacao {
  habilitacao_tecnica: Array<{ requisito: string; detalhes: string }>;
  habilitacao_juridica: Array<{ documento: string; detalhes: string }>;
  habilitacao_financeira: Array<{ requisito: string; detalhes: string }>;
  declaracoes_exigidas: Array<{ declaracao: string; modelo_anexo: string | null }>;
  obrigacoes_lei_14133: Array<{ artigo: string; descricao: string }>;
}

export interface ExtractedRisk {
  condicoes_particulares: Array<{
    condicao: string;
    justificativa: string;
    nivel_atencao: 'baixo' | 'medio' | 'alto';
  }>;
  pontos_impugnacao: Array<{
    ponto: string;
    fundamento: string;
    gravidade: 'baixa' | 'media' | 'alta';
  }>;
  overall_risk: 'baixo' | 'medio' | 'alto';
  risk_factors: Array<{ categoria: string; descricao: string; gravidade: 'baixa' | 'media' | 'alta' }>;
}

export interface ExtractedExecutiveSummary {
  executive_summary: string;
  recommendation: 'participar' | 'participar_com_cautela' | 'nao_participar';
  justificativa_recomendacao: string;
}

export interface FullAnalysisResult {
  basicInfo: ExtractedBasicInfo;
  habilitacao: ExtractedHabilitacao;
  risk: ExtractedRisk;
  executiveSummary: ExtractedExecutiveSummary;
  capag?: {
    municipalityIbgeCode: string;
    municipalityName: string;
    uf: string;
    capagRating: string;
    explanation: string;
    referenceYear: number;
  } | null;
  analyzedAt: string;
}

// ─── Legacy interface (for backward compat with existing DB schema) ───────────

interface LegacyAnalysisResult {
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: 'participate' | 'caution' | 'avoid';
  executiveSummary: string;
  documentAlerts: Array<{ item: string; document: string; reason: string }>;
  impugnationPoints: Array<{
    title: string;
    description: string;
    legalBasis: string;
    articleNumber: string;
    explanation: string;
  }>;
  paymentConditions: { deadline: string; method: string; details: string };
  guaranteeContractual: string;
  guaranteeObject: string;
  objectDescription: string;
  deliveryLocation: string;
  deliveryDeadline: string;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private readonly gemini: GoogleGenerativeAI | null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private capagService: CapagService,
  ) {
    const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY', '');
    if (apiKey) {
      this.gemini = new GoogleGenerativeAI(apiKey);
      this.logger.log('Google Gemini client initialized — AI analysis enabled');
    } else {
      this.gemini = null;
      this.logger.warn(
        'GOOGLE_GEMINI_API_KEY not set — AI analysis will be skipped (graceful degradation)',
      );
    }
  }

  // ─── Public: List analyses ───────────────────────────────────────────────────

  async listAnalyses(tenantId?: string) {
    // BiddingAnalysis doesn't have a tenantId field; we list recent analyses
    const analyses = await this.prisma.biddingAnalysis.findMany({
      orderBy: { analyzedAt: 'desc' },
      take: 50,
      include: {
        bidding: {
          select: {
            objectText: true,
            objectSummary: true,
            agencyName: true,
            biddingNumber: true,
          },
        },
      },
    });

    return analyses.map((a) => ({
      id: a.id,
      biddingId: a.biddingId,
      objeto: a.objectDescription ?? a.bidding?.objectSummary ?? a.bidding?.objectText ?? null,
      orgao: a.bidding?.agencyName ?? null,
      numeroEdital: a.bidding?.biddingNumber ?? null,
      recomendacao: this.mapRecommendationToFrontend(a.recommendation),
      resumoExecutivo: a.executiveSummary ?? null,
      createdAt: (a.analyzedAt ?? a.createdAt)?.toISOString() ?? null,
      rawAnalysis: a.rawAnalysis ?? null,
    }));
  }

  private mapRecommendationToFrontend(rec: string | null): string | null {
    const map: Record<string, string> = {
      participate: 'participar',
      caution: 'cautela',
      avoid: 'nao_participar',
    };
    return rec ? (map[rec] ?? rec) : null;
  }

  // ─── Public: Send analysis to tenant (best-effort log) ──────────────────────

  async sendToTenant(analysisId: string, tenantId: string): Promise<{ success: boolean; analysisId: string; tenantId: string }> {
    // Validate analysis exists
    await this.getAnalysisById(analysisId);
    this.logger.log(`Analysis ${analysisId} marked for delivery to tenant ${tenantId}`);
    return { success: true, analysisId, tenantId };
  }

  // ─── Public: Get saved analysis ─────────────────────────────────────────────

  async getAnalysisByBiddingId(biddingId: string) {
    const analysis = await this.prisma.biddingAnalysis.findUnique({
      where: { biddingId },
      include: { bidding: true },
    });
    if (!analysis) {
      throw new NotFoundException(`Analysis not found for bidding ${biddingId}`);
    }
    return analysis;
  }

  async getAnalysisById(id: string) {
    const analysis = await this.prisma.biddingAnalysis.findUnique({
      where: { id },
      include: { bidding: { include: { items: true } } },
    });
    if (!analysis) {
      throw new NotFoundException(`Analysis ${id} not found`);
    }
    return analysis;
  }

  // ─── Public: Analyze from biddingId ─────────────────────────────────────────

  async analyzeEdital(biddingId: string): Promise<void> {
    if (!this.gemini) {
      this.logger.warn(
        `Skipping Gemini analysis for bidding ${biddingId} — GOOGLE_GEMINI_API_KEY not configured`,
      );
      return;
    }

    const bidding = await this.prisma.bidding.findUnique({
      where: { id: biddingId },
      include: {
        items: {
          select: {
            itemNumber: true,
            description: true,
            quantity: true,
            unit: true,
            unitValueEstimated: true,
            totalValueEstimated: true,
            catalogCode: true,
          },
        },
        documents: {
          select: { documentType: true, fileName: true, sourceUrl: true },
        },
      },
    });

    if (!bidding) {
      throw new NotFoundException(`Bidding ${biddingId} not found`);
    }

    this.logger.log(`Starting Gemini analysis for bidding ${biddingId}`);

    const editalContent = this.buildEditalContext(bidding);
    const fullResult = await this.runAnalysisPipeline(editalContent, bidding.sphere ?? null, bidding.municipalityIbgeCode ?? null);

    await this.saveAnalysisResult(biddingId, fullResult);
    this.logger.log(`Analysis saved for bidding ${biddingId}: risk=${fullResult.risk.overall_risk} recommendation=${fullResult.executiveSummary.recommendation}`);
  }

  // ─── Public: Analyze from raw text ──────────────────────────────────────────

  async analyzeFromText(
    editalContent: string,
    options: { opportunityId?: string; tenantId?: string; biddingId?: string } = {},
  ): Promise<FullAnalysisResult> {
    if (!this.gemini) {
      throw new BadRequestException(
        'GOOGLE_GEMINI_API_KEY não configurado. Análise de IA não disponível.',
      );
    }

    this.logger.log(`Iniciando análise Gemini — tamanho do texto: ${editalContent.length} chars`);

    const result = await this.runAnalysisPipeline(editalContent, null, null);

    if (options.biddingId) {
      await this.saveAnalysisResult(options.biddingId, result);
    }

    return result;
  }

  // ─── Public: Save upload analysis (no biddingId) ────────────────────────────

  async saveUploadAnalysis(result: FullAnalysisResult): Promise<string> {
    const legacy = this.mapToLegacy(result);
    const rawAnalysis = result as unknown as object;

    // Use unchecked create to allow nullable biddingId
    const record = await this.prisma.biddingAnalysis.create({
      data: {
        riskLevel: legacy.riskLevel,
        recommendation: legacy.recommendation,
        executiveSummary: legacy.executiveSummary,
        documentAlerts: legacy.documentAlerts as unknown as object,
        impugnationPoints: legacy.impugnationPoints as unknown as object,
        paymentConditions: legacy.paymentConditions as unknown as object,
        guaranteeContractual: legacy.guaranteeContractual || null,
        guaranteeObject: legacy.guaranteeObject || null,
        objectDescription: legacy.objectDescription || null,
        deliveryLocation: legacy.deliveryLocation || null,
        deliveryDeadline: legacy.deliveryDeadline || null,
        rawAnalysis,
        analyzedAt: new Date(),
      } as Parameters<typeof this.prisma.biddingAnalysis.create>[0]['data'],
    });

    this.logger.log(`Análise salva com id=${record.id}`);
    return record.id;
  }

  // ─── Public: Compute compatible companies ───────────────────────────────────

  async computeCompatibleCompanies(result: FullAnalysisResult): Promise<Array<{
    tenantId: string;
    name: string;
    cnpj: string;
    score: number;
    matchingCnaes: string[];
  }>> {
    try {
      // Fetch tenants with their CNAEs and keywords using typed queries
      const tenantsBase = await this.prisma.tenant.findMany();
      // Use any cast for models that might not be in the stale local TS types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prismaAny = this.prisma as any;
      const allCnaes = await prismaAny.companyCnae.findMany() as Array<{ tenantId: string; code: string; description: string; isPrimary: boolean }>;
      const allKeywords = await this.prisma.companyKeyword.findMany();

      // Build maps for quick lookup
      const cnaesByTenant = new Map<string, Array<{ code: string; description: string }>>();
      for (const c of allCnaes) {
        const existing = cnaesByTenant.get(c.tenantId) ?? [];
        existing.push({ code: c.code, description: c.description });
        cnaesByTenant.set(c.tenantId, existing);
      }

      const kwByTenant = new Map<string, string[]>();
      for (const k of allKeywords) {
        const existing = kwByTenant.get(k.tenantId) ?? [];
        existing.push(k.keyword.toLowerCase());
        kwByTenant.set(k.tenantId, existing);
      }

      // Build list of keywords from the edital text
      const editalText = JSON.stringify(result).toLowerCase();

      // Extract CNAE codes mentioned in items (patterns like XXXX-X/XX or 7 digits)
      const cnaePattern = /\b(\d{4}[-.\s]?\d{1}[-.\s]?\d{2})\b/g;
      const editalCnaes = new Set<string>();
      const allText = JSON.stringify(result);
      let m: RegExpExecArray | null;
      while ((m = cnaePattern.exec(allText)) !== null) {
        editalCnaes.add(m[1].replace(/\D/g, '').padStart(7, '0'));
      }

      const items = result.basicInfo.items_licitacao ?? [];
      const objeto = (result.basicInfo.objeto ?? '').toLowerCase();

      const compatible = tenantsBase.map((tenant) => {
        const tenantCnaes = cnaesByTenant.get(tenant.id) ?? [];
        const tenantKeywords = kwByTenant.get(tenant.id) ?? [];

        const tenantCodes = tenantCnaes.map((c) => c.code.replace(/\D/g, '').padStart(7, '0'));

        // CNAE matching: compare tenant codes vs edital codes (first 4 digits = class)
        const matchingCnaeLabels: string[] = [];
        let cnaeMatches = 0;

        for (const tc of tenantCodes) {
          const tcClass = tc.substring(0, 4);
          const matched =
            editalCnaes.has(tc) ||
            [...editalCnaes].some((ec) => ec.substring(0, 4) === tcClass) ||
            // Also check description match against objeto + items
            tenantCnaes
              .find((c) => c.code.replace(/\D/g, '').padStart(7, '0') === tc)
              ?.description.toLowerCase()
              .split(' ')
              .filter((w) => w.length > 4)
              .some((w) => objeto.includes(w) || items.some((it) => it.descricao?.toLowerCase().includes(w)));

          if (matched) {
            cnaeMatches++;
            const desc = tenantCnaes.find((c) => c.code.replace(/\D/g, '').padStart(7, '0') === tc)?.description;
            matchingCnaeLabels.push(desc ? `CNAE ${tc} - ${desc}` : `CNAE ${tc}`);
          }
        }

        // Keyword matching
        let kwMatches = 0;
        for (const kw of tenantKeywords) {
          if (kw.length > 2 && editalText.includes(kw)) {
            kwMatches++;
            matchingCnaeLabels.push(`"${kw}"`);
          }
        }

        // Score formula: CNAE weight 70%, keyword weight 30%
        const totalCnaes = tenantCodes.length;
        const totalKw = tenantKeywords.length;

        let score = 0;
        if (totalCnaes > 0) {
          score += (cnaeMatches / totalCnaes) * 70;
        }
        if (totalKw > 0) {
          score += (kwMatches / totalKw) * 30;
        }

        return {
          tenantId: tenant.id,
          name: tenant.tradeName || tenant.corporateName,
          cnpj: tenant.cnpj,
          score: Math.round(score),
          matchingCnaes: matchingCnaeLabels,
        };
      });

      return compatible
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score);
    } catch (err) {
      this.logger.error(`Erro ao computar empresas compatíveis: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  // ─── Pipeline: 4 sequential Gemini calls ─────────────────────────────────────

  async runAnalysisPipeline(
    editalContent: string,
    sphere: string | null,
    municipalityIbgeCode: string | null,
  ): Promise<FullAnalysisResult> {
    const model = this.gemini!.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // ── Call 1: Basic extraction ────────────────────────────────────────────────
    let basicInfo: ExtractedBasicInfo;
    try {
      const prompt1 = `Você é um especialista em licitações públicas brasileiras. Analise o conteúdo do edital abaixo e extraia as informações solicitadas em JSON.

EDITAL:
${editalContent}

Extraia as seguintes informações em JSON VÁLIDO (sem markdown, sem explicações fora do JSON):
{
  "numero_pregao": "string ou null",
  "numero_uasg": "string ou null",
  "nome_orgao": "string ou null",
  "esfera": "municipal" | "estadual" | "federal" | null,
  "municipio": "string ou null",
  "uf": "string (sigla 2 letras) ou null",
  "data_licitacao": "string DD/MM/AAAA ou null",
  "hora_licitacao": "string HH:MM ou null",
  "objeto": "string descricao completa ou null",
  "vigencia_contratacao": "string ou null",
  "valor_estimado": "string formatado R$ ou null",
  "garantia_contratual": { "exige": boolean, "percentual": "string ou null" } ou null,
  "garantia_objeto": { "exige": boolean, "descricao": "string ou null" } ou null,
  "local_execucao": "string ou null",
  "locais_entrega": [{ "endereco_completo": "string", "cidade_uf": "string" }],
  "pagamento": { "prazo": "string", "forma": "string", "detalhes": "string" } ou null,
  "especificacao_servico": "string resumo tecnico ou null",
  "items_licitacao": [
    {
      "item_number": number,
      "codigo": "string ou null",
      "descricao": "string",
      "quantidade": number,
      "unidade": "string",
      "valor_unitario": "string ou null",
      "valor_total": "string ou null"
    }
  ]
}

IMPORTANTE: Responda SOMENTE com o JSON, sem markdown, sem bloco de código.`;

      const result1 = await model.generateContent(prompt1);
      const text1 = result1.response.text();
      this.logger.log(`Chamada 1 (BasicInfo) - Resposta Gemini: ${text1.substring(0, 300)}`);
      basicInfo = this.parseGeminiJson<ExtractedBasicInfo>(text1) ?? this.defaultBasicInfo();
    } catch (err) {
      this.logger.error(`Call 1 (BasicInfo) failed: ${err instanceof Error ? err.message : String(err)}`);
      basicInfo = this.defaultBasicInfo();
    }

    // ── Call 2: Habilitacao and declarations ────────────────────────────────────
    let habilitacao: ExtractedHabilitacao;
    try {
      const prompt2 = `Você é um especialista em licitações públicas brasileiras com foco em habilitação. Analise o edital abaixo.

EDITAL:
${editalContent}

Extraia as seguintes informações em JSON VÁLIDO (sem markdown):
{
  "habilitacao_tecnica": [{ "requisito": "string", "detalhes": "string" }],
  "habilitacao_juridica": [{ "documento": "string", "detalhes": "string" }],
  "habilitacao_financeira": [{ "requisito": "string", "detalhes": "string" }],
  "declaracoes_exigidas": [{ "declaracao": "string", "modelo_anexo": "string ou null" }],
  "obrigacoes_lei_14133": [{ "artigo": "string", "descricao": "string" }]
}

IMPORTANTE: Responda SOMENTE com o JSON, sem markdown, sem bloco de código.`;

      const result2 = await model.generateContent(prompt2);
      const text2 = result2.response.text();
      this.logger.log(`Chamada 2 (Habilitacao) - Resposta Gemini: ${text2.substring(0, 300)}`);
      habilitacao = this.parseGeminiJson<ExtractedHabilitacao>(text2) ?? this.defaultHabilitacao();
    } catch (err) {
      this.logger.error(`Call 2 (Habilitacao) failed: ${err instanceof Error ? err.message : String(err)}`);
      habilitacao = this.defaultHabilitacao();
    }

    // ── Call 3: Risk analysis ────────────────────────────────────────────────────
    let risk: ExtractedRisk;
    try {
      const prompt3 = `Você é um especialista sênior em licitações públicas brasileiras e análise de riscos. Analise o edital abaixo.

EDITAL:
${editalContent}

REGRAS CRÍTICAS DE AVALIAÇÃO:
- Índices financeiros normais (liquidez, patrimônio) NÃO são condição particular
- Prazos de 2 horas ou mais para proposta NÃO são ponto de impugnação
- Garantia contratual até 5% NÃO é condição particular restritiva
- Considere risco real APENAS: direcionamento de marca/especificação, ilegalidade clara, prazos impossíveis (<1h), exigências técnicas excessivas sem justificativa

Extraia em JSON VÁLIDO:
{
  "condicoes_particulares": [
    { "condicao": "string", "justificativa": "string", "nivel_atencao": "baixo" | "medio" | "alto" }
  ],
  "pontos_impugnacao": [
    { "ponto": "string", "fundamento": "string (base legal)", "gravidade": "baixa" | "media" | "alta" }
  ],
  "overall_risk": "baixo" | "medio" | "alto",
  "risk_factors": [
    { "categoria": "string", "descricao": "string", "gravidade": "baixa" | "media" | "alta" }
  ]
}

IMPORTANTE: Responda SOMENTE com o JSON, sem markdown, sem bloco de código.`;

      const result3 = await model.generateContent(prompt3);
      const text3 = result3.response.text();
      this.logger.log(`Chamada 3 (Risk) - Resposta Gemini: ${text3.substring(0, 300)}`);
      risk = this.parseGeminiJson<ExtractedRisk>(text3) ?? this.defaultRisk();
    } catch (err) {
      this.logger.error(`Call 3 (Risk) failed: ${err instanceof Error ? err.message : String(err)}`);
      risk = this.defaultRisk();
    }

    // ── Call 4a: CAPAG (only if municipal) ──────────────────────────────────────
    let capag: FullAnalysisResult['capag'] = null;
    const effectiveSphere = sphere ?? basicInfo.esfera;
    const effectiveIbge = municipalityIbgeCode;

    if (effectiveSphere === 'municipal' && effectiveIbge) {
      try {
        capag = await this.capagService.getCapagByMunicipality(effectiveIbge);
      } catch (err) {
        this.logger.warn(`CAPAG lookup failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── Call 4b: Executive summary ───────────────────────────────────────────────
    let executiveSummary: ExtractedExecutiveSummary;
    try {
      const capagContext = capag
        ? `\nCAP AG do Município: ${capag.capagRating} — ${capag.explanation} (${capag.referenceYear})`
        : '';

      const prompt4 = `Você é um especialista sênior em licitações públicas brasileiras. Com base na análise completa do edital abaixo, gere o resumo executivo final.

EDITAL:
${editalContent}

CONTEXTO DA ANÁLISE:
- Risco geral identificado: ${risk.overall_risk}
- Fatores de risco: ${JSON.stringify(risk.risk_factors)}
- Condições particulares: ${JSON.stringify(risk.condicoes_particulares)}
- Pontos de impugnação: ${JSON.stringify(risk.pontos_impugnacao)}${capagContext}

Gere em JSON VÁLIDO:
{
  "executive_summary": "string com 3 a 5 parágrafos em português, linguagem clara para o empresário. Descreva o objeto, condições gerais, principais riscos e oportunidades",
  "recommendation": "participar" | "participar_com_cautela" | "nao_participar",
  "justificativa_recomendacao": "string com justificativa clara e objetiva da recomendação em 2-3 frases"
}

CRITÉRIOS:
- "participar": risco baixo, condições favoráveis, sem ilegalidades
- "participar_com_cautela": riscos moderados ou condições específicas a verificar
- "nao_participar": risco alto, ilegalidades graves, inviabilidade técnica/financeira

IMPORTANTE: Responda SOMENTE com o JSON, sem markdown, sem bloco de código.`;

      const result4 = await model.generateContent(prompt4);
      const text4 = result4.response.text();
      this.logger.log(`Chamada 4 (ExecutiveSummary) - Resposta Gemini: ${text4.substring(0, 300)}`);
      executiveSummary = this.parseGeminiJson<ExtractedExecutiveSummary>(text4) ?? this.defaultExecutiveSummary();
    } catch (err) {
      this.logger.error(`Call 4b (ExecutiveSummary) failed: ${err instanceof Error ? err.message : String(err)}`);
      executiveSummary = this.defaultExecutiveSummary();
    }

    return {
      basicInfo,
      habilitacao,
      risk,
      executiveSummary,
      capag,
      analyzedAt: new Date().toISOString(),
    };
  }

  // ─── Save to DB (maps to existing BiddingAnalysis schema) ────────────────────

  async saveAnalysisResult(biddingId: string, result: FullAnalysisResult): Promise<void> {
    const legacy = this.mapToLegacy(result);
    const rawAnalysis = result as unknown as object;

    await this.prisma.biddingAnalysis.upsert({
      where: { biddingId },
      create: {
        biddingId,
        riskLevel: legacy.riskLevel,
        recommendation: legacy.recommendation,
        executiveSummary: legacy.executiveSummary,
        documentAlerts: legacy.documentAlerts as unknown as object,
        impugnationPoints: legacy.impugnationPoints as unknown as object,
        paymentConditions: legacy.paymentConditions as unknown as object,
        guaranteeContractual: legacy.guaranteeContractual || null,
        guaranteeObject: legacy.guaranteeObject || null,
        objectDescription: legacy.objectDescription || null,
        deliveryLocation: legacy.deliveryLocation || null,
        deliveryDeadline: legacy.deliveryDeadline || null,
        rawAnalysis,
        analyzedAt: new Date(),
      },
      update: {
        riskLevel: legacy.riskLevel,
        recommendation: legacy.recommendation,
        executiveSummary: legacy.executiveSummary,
        documentAlerts: legacy.documentAlerts as unknown as object,
        impugnationPoints: legacy.impugnationPoints as unknown as object,
        paymentConditions: legacy.paymentConditions as unknown as object,
        guaranteeContractual: legacy.guaranteeContractual || null,
        guaranteeObject: legacy.guaranteeObject || null,
        objectDescription: legacy.objectDescription || null,
        deliveryLocation: legacy.deliveryLocation || null,
        deliveryDeadline: legacy.deliveryDeadline || null,
        rawAnalysis,
        analyzedAt: new Date(),
      },
    });
  }

  // ─── Build context text from Bidding record ──────────────────────────────────

  private buildEditalContext(bidding: {
    biddingNumber: string | null;
    modality: string | null;
    uasg: string | null;
    sphere: string | null;
    agencyName: string | null;
    objectText: string;
    objectSummary: string | null;
    estimatedValue: unknown;
    municipalityName: string | null;
    uf: string | null;
    openingDate: Date | null;
    proposalDueDate: Date | null;
    items: Array<{
      itemNumber: number;
      description: string;
      quantity: unknown;
      unit: string;
      unitValueEstimated: unknown;
      totalValueEstimated: unknown;
      catalogCode: string | null;
    }>;
    documents: Array<{ documentType: string; fileName: string; sourceUrl: string | null }>;
  }): string {
    const itemsText = bidding.items
      .map(
        (i) =>
          `Item ${i.itemNumber}: ${i.description} | Qtd: ${i.quantity} ${i.unit} | Valor unit.: R$ ${i.unitValueEstimated ?? 'N/I'} | Total: R$ ${i.totalValueEstimated ?? 'N/I'}${i.catalogCode ? ` | Código: ${i.catalogCode}` : ''}`,
      )
      .join('\n');

    const documentsText = bidding.documents
      .map((d) => `- ${d.documentType}: ${d.fileName}${d.sourceUrl ? ` (${d.sourceUrl})` : ''}`)
      .join('\n');

    return `LICITAÇÃO PÚBLICA — DADOS EXTRAÍDOS DO SISTEMA

Número: ${bidding.biddingNumber ?? 'Não informado'}
Modalidade: ${bidding.modality ?? 'Não informado'}
UASG: ${bidding.uasg ?? 'Não informado'}
Esfera: ${bidding.sphere ?? 'Não informado'}
Órgão: ${bidding.agencyName ?? 'Não informado'}
Município/UF: ${bidding.municipalityName ?? ''} ${bidding.uf ?? ''}
Valor estimado: R$ ${bidding.estimatedValue ?? 'Não informado'}
Data de abertura: ${bidding.openingDate ? new Date(bidding.openingDate).toLocaleDateString('pt-BR') : 'Não informado'}
Prazo propostas: ${bidding.proposalDueDate ? new Date(bidding.proposalDueDate).toLocaleDateString('pt-BR') : 'Não informado'}

OBJETO:
${bidding.objectText}

${bidding.objectSummary ? `RESUMO DO OBJETO:\n${bidding.objectSummary}\n` : ''}

ITENS:
${itemsText || 'Nenhum item detalhado disponível'}

DOCUMENTOS ANEXOS:
${documentsText || 'Nenhum documento listado'}`;
  }

  // ─── Map full result to legacy DB schema ─────────────────────────────────────

  private mapToLegacy(result: FullAnalysisResult): LegacyAnalysisResult {
    const riskMap: Record<string, 'low' | 'medium' | 'high'> = {
      baixo: 'low',
      medio: 'medium',
      alto: 'high',
    };
    const recMap: Record<string, 'participate' | 'caution' | 'avoid'> = {
      participar: 'participate',
      participar_com_cautela: 'caution',
      nao_participar: 'avoid',
    };

    const riskLevel = riskMap[result.risk.overall_risk] ?? 'medium';
    const recommendation = recMap[result.executiveSummary.recommendation] ?? 'caution';

    // Build document alerts from habilitacao
    const documentAlerts: LegacyAnalysisResult['documentAlerts'] = [
      ...result.habilitacao.habilitacao_tecnica.map((h) => ({
        item: 'Habilitação Técnica',
        document: h.requisito,
        reason: h.detalhes,
      })),
      ...result.habilitacao.habilitacao_juridica.map((h) => ({
        item: 'Habilitação Jurídica',
        document: h.documento,
        reason: h.detalhes,
      })),
      ...result.habilitacao.declaracoes_exigidas.map((d) => ({
        item: d.modelo_anexo ?? 'Declaração',
        document: d.declaracao,
        reason: 'Declaração exigida pelo edital',
      })),
    ];

    // Build impugnation points
    const impugnationPoints: LegacyAnalysisResult['impugnationPoints'] =
      result.risk.pontos_impugnacao.map((p) => ({
        title: p.ponto,
        description: p.ponto,
        legalBasis: p.fundamento,
        articleNumber: '',
        explanation: `Gravidade: ${p.gravidade}. ${p.fundamento}`,
      }));

    const pagamento = result.basicInfo.pagamento;
    const paymentConditions = pagamento
      ? { deadline: pagamento.prazo, method: pagamento.forma, details: pagamento.detalhes }
      : { deadline: 'Não informado', method: 'Não informado', details: '' };

    const gc = result.basicInfo.garantia_contratual;
    const go = result.basicInfo.garantia_objeto;

    return {
      riskLevel,
      recommendation,
      executiveSummary: result.executiveSummary.executive_summary,
      documentAlerts,
      impugnationPoints,
      paymentConditions,
      guaranteeContractual: gc
        ? gc.exige
          ? `Exigida${gc.percentual ? ` — ${gc.percentual}` : ''}`
          : 'Não exigida'
        : 'Verificar no edital',
      guaranteeObject: go
        ? go.exige
          ? `Exigida${go.descricao ? ` — ${go.descricao}` : ''}`
          : 'Não exigida'
        : 'Verificar no edital',
      objectDescription: result.basicInfo.objeto ?? '',
      deliveryLocation: result.basicInfo.local_execucao ?? '',
      deliveryDeadline: result.basicInfo.vigencia_contratacao ?? '',
    };
  }

  // ─── JSON parse helper ───────────────────────────────────────────────────────

  private parseGeminiJson<T>(rawText: string): T | null {
    try {
      // Strip markdown code fences (```json ... ``` or ``` ... ```)
      const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        return JSON.parse(fenceMatch[1].trim()) as T;
      }

      // Find the first { or [ and last } or ]
      const startBrace = rawText.indexOf('{');
      const startBracket = rawText.indexOf('[');
      const start = startBrace === -1 ? startBracket
        : startBracket === -1 ? startBrace
        : Math.min(startBrace, startBracket);

      if (start >= 0) {
        const openChar = rawText[start];
        const closeChar = openChar === '{' ? '}' : ']';
        const end = rawText.lastIndexOf(closeChar);
        if (end > start) {
          const jsonText = rawText.slice(start, end + 1).trim();
          return JSON.parse(jsonText) as T;
        }
      }
    } catch (parseErr) {
      this.logger.warn(`Falha ao parsear JSON do Gemini: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
    }
    this.logger.warn(`Failed to parse Gemini JSON response. Raw preview: ${rawText.substring(0, 200)}`);
    return null;
  }

  // ─── Default fallbacks ────────────────────────────────────────────────────────

  private defaultBasicInfo(): ExtractedBasicInfo {
    return {
      numero_pregao: null,
      numero_uasg: null,
      nome_orgao: null,
      esfera: null,
      municipio: null,
      uf: null,
      data_licitacao: null,
      hora_licitacao: null,
      objeto: null,
      vigencia_contratacao: null,
      valor_estimado: null,
      garantia_contratual: null,
      garantia_objeto: null,
      local_execucao: null,
      locais_entrega: [],
      pagamento: null,
      especificacao_servico: null,
      items_licitacao: [],
    };
  }

  private defaultHabilitacao(): ExtractedHabilitacao {
    return {
      habilitacao_tecnica: [],
      habilitacao_juridica: [],
      habilitacao_financeira: [],
      declaracoes_exigidas: [],
      obrigacoes_lei_14133: [],
    };
  }

  private defaultRisk(): ExtractedRisk {
    return {
      condicoes_particulares: [],
      pontos_impugnacao: [],
      overall_risk: 'medio',
      risk_factors: [],
    };
  }

  private defaultExecutiveSummary(): ExtractedExecutiveSummary {
    return {
      executive_summary:
        'Não foi possível gerar o resumo executivo automaticamente. Verifique os dados do edital e tente novamente.',
      recommendation: 'participar_com_cautela',
      justificativa_recomendacao:
        'Análise incompleta. Recomenda-se verificação manual do edital.',
    };
  }
}
