import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface DocumentAlert {
  item: string;
  document: string;
  reason: string;
}

interface ImpugnationPoint {
  title: string;
  description: string;
  legalBasis: string;
  articleNumber: string;
  explanation: string;
}

interface PaymentConditions {
  deadline: string;
  method: string;
  details: string;
}

interface ClaudeAnalysisResult {
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: 'participate' | 'caution' | 'avoid';
  executiveSummary: string;
  documentAlerts: DocumentAlert[];
  impugnationPoints: ImpugnationPoint[];
  paymentConditions: PaymentConditions;
  guaranteeContractual: string;
  guaranteeObject: string;
  objectDescription: string;
  deliveryLocation: string;
  deliveryDeadline: string;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private readonly anthropic: Anthropic | null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY', '');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log('Anthropic client initialized — Claude analysis enabled');
    } else {
      this.anthropic = null;
      this.logger.warn('ANTHROPIC_API_KEY not set — Claude analysis will be skipped (graceful degradation)');
    }
  }

  async getAnalysisByBiddingId(biddingId: string) {
    const analysis = await this.prisma.biddingAnalysis.findUnique({
      where: { biddingId },
    });
    if (!analysis) {
      throw new NotFoundException(`Analysis not found for bidding ${biddingId}`);
    }
    return analysis;
  }

  async analyzeEdital(biddingId: string): Promise<void> {
    if (!this.anthropic) {
      this.logger.warn(
        `Skipping Claude analysis for bidding ${biddingId} — ANTHROPIC_API_KEY not configured`,
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

    this.logger.log(`Starting Claude analysis for bidding ${biddingId}`);

    const prompt = this.buildPrompt(bidding);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const message = await this.anthropic!.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const rawContent = message.content[0];
    if (rawContent.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const rawText = rawContent.text;
    const parsed = this.parseClaudeResponse(rawText);

    await this.prisma.biddingAnalysis.upsert({
      where: { biddingId },
      create: {
        biddingId,
        riskLevel: parsed.riskLevel,
        recommendation: parsed.recommendation,
        executiveSummary: parsed.executiveSummary,
        documentAlerts: parsed.documentAlerts as unknown as object,
        impugnationPoints: parsed.impugnationPoints as unknown as object,
        paymentConditions: parsed.paymentConditions as unknown as object,
        guaranteeContractual: parsed.guaranteeContractual || null,
        guaranteeObject: parsed.guaranteeObject || null,
        objectDescription: parsed.objectDescription || null,
        deliveryLocation: parsed.deliveryLocation || null,
        deliveryDeadline: parsed.deliveryDeadline || null,
        rawAnalysis: { text: rawText } as unknown as object,
        analyzedAt: new Date(),
      },
      update: {
        riskLevel: parsed.riskLevel,
        recommendation: parsed.recommendation,
        executiveSummary: parsed.executiveSummary,
        documentAlerts: parsed.documentAlerts as unknown as object,
        impugnationPoints: parsed.impugnationPoints as unknown as object,
        paymentConditions: parsed.paymentConditions as unknown as object,
        guaranteeContractual: parsed.guaranteeContractual || null,
        guaranteeObject: parsed.guaranteeObject || null,
        objectDescription: parsed.objectDescription || null,
        deliveryLocation: parsed.deliveryLocation || null,
        deliveryDeadline: parsed.deliveryDeadline || null,
        rawAnalysis: { text: rawText } as unknown as object,
        analyzedAt: new Date(),
      },
    });

    this.logger.log(
      `Analysis saved for bidding ${biddingId}: riskLevel=${parsed.riskLevel} recommendation=${parsed.recommendation}`,
    );
  }

  private buildPrompt(bidding: {
    id: string;
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
    documents: Array<{
      documentType: string;
      fileName: string;
      sourceUrl: string | null;
    }>;
  }): string {
    const itemsText = bidding.items
      .map(
        (i) =>
          `  Item ${i.itemNumber}: ${i.description} | Qtd: ${i.quantity} ${i.unit} | Valor unit. est.: R$ ${i.unitValueEstimated ?? 'N/I'} | Total est.: R$ ${i.totalValueEstimated ?? 'N/I'}`,
      )
      .join('\n');

    const documentsText = bidding.documents
      .map((d) => `  - ${d.documentType}: ${d.fileName}`)
      .join('\n');

    return `Você é um especialista sênior em licitações públicas brasileiras com mais de 20 anos de experiência. Sua missão é analisar o edital de licitação abaixo e fornecer uma análise jurídica e operacional completa.

DADOS DA LICITAÇÃO:
- Número: ${bidding.biddingNumber ?? 'Não informado'}
- Modalidade: ${bidding.modality ?? 'Não informado'}
- UASG: ${bidding.uasg ?? 'Não informado'}
- Esfera: ${bidding.sphere ?? 'Não informado'}
- Órgão: ${bidding.agencyName ?? 'Não informado'}
- Município/UF: ${bidding.municipalityName ?? ''} ${bidding.uf ?? ''}
- Valor estimado: R$ ${bidding.estimatedValue ?? 'Não informado'}
- Data de abertura: ${bidding.openingDate ? new Date(bidding.openingDate).toLocaleDateString('pt-BR') : 'Não informado'}
- Prazo de envio de propostas: ${bidding.proposalDueDate ? new Date(bidding.proposalDueDate).toLocaleDateString('pt-BR') : 'Não informado'}

OBJETO DA LICITAÇÃO:
${bidding.objectText}

${bidding.objectSummary ? `RESUMO DO OBJETO:\n${bidding.objectSummary}\n` : ''}

ITENS DA LICITAÇÃO:
${itemsText || '  Nenhum item detalhado disponível'}

DOCUMENTOS ANEXOS:
${documentsText || '  Nenhum documento listado'}

---

INSTRUÇÕES DE ANÁLISE:

Analise este edital com base na Lei nº 14.133/2021 (Nova Lei de Licitações e Contratos Administrativos), Instrução Normativa SEGES/ME nº 65/2021, e jurisprudência do TCU (Tribunal de Contas da União).

Avalie os seguintes aspectos:

1. **Nível de risco geral** (low/medium/high): Considere complexidade do objeto, capacidade financeira do órgão (CAPAG se municipal), prazo, valor, exigências de habilitação, condições de pagamento.

2. **Recomendação** (participate/caution/avoid): Com base no risco e nas condições gerais.

3. **Resumo executivo**: Análise sucinta em linguagem clara para o empresário leigo, destacando os pontos mais importantes.

4. **Alertas de documentos**: Identifique documentos de habilitação que podem ser problemáticos (ex.: certidões Anvisa, ISO, ABNT, laudos técnicos, registros especiais, certificações específicas do setor). Para cada alerta, informe qual documento é exigido, por qual razão é um risco e o item do edital que o exige.

5. **Pontos de impugnação**: Identifique cláusulas do edital que violam a Lei 14.133/2021 ou entendimentos consolidados do TCU e que possam ser impugnadas. Para cada ponto: título do vício, descrição técnica, base legal (artigo da lei), número do artigo, e explicação em linguagem simples para o empresário. Cite acordãos do TCU quando aplicável (ex.: Acórdão 2.171/2011-TCU-Plenário sobre sigilo de orçamento).

6. **Condições de pagamento**: Extraia prazo de pagamento (em dias), forma de pagamento (transferência bancária, empenho, etc.) e detalhes relevantes.

7. **Garantia contratual**: Descreva a garantia exigida para execução do contrato (valor percentual, modalidades aceitas) conforme Art. 96 da Lei 14.133/2021.

8. **Garantia do objeto**: Descreva a garantia de qualidade/manutenção do objeto entregue (prazo de garantia, assistência técnica).

9. **Descrição do objeto**: Descrição clara e objetiva do que está sendo licitado.

10. **Local de entrega**: Endereço ou localidade onde o objeto deve ser entregue.

11. **Prazo de entrega**: Prazo para entrega ou execução após assinatura do contrato.

FORMATO DE RESPOSTA:
Responda SOMENTE com JSON válido, sem markdown, sem explicações fora do JSON. Use exatamente esta estrutura:

{
  "riskLevel": "low" | "medium" | "high",
  "recommendation": "participate" | "caution" | "avoid",
  "executiveSummary": "string com resumo executivo em português",
  "documentAlerts": [
    {
      "item": "número ou referência do item do edital",
      "document": "nome do documento exigido",
      "reason": "por que esse documento é um alerta ou risco"
    }
  ],
  "impugnationPoints": [
    {
      "title": "título curto do vício",
      "description": "descrição técnica do problema",
      "legalBasis": "nome da lei ou norma violada",
      "articleNumber": "número do artigo",
      "explanation": "explicação em linguagem simples para o empresário"
    }
  ],
  "paymentConditions": {
    "deadline": "prazo em dias úteis ou corridos",
    "method": "forma de pagamento",
    "details": "detalhes adicionais sobre pagamento"
  },
  "guaranteeContractual": "descrição da garantia contratual ou 'Não exigida'",
  "guaranteeObject": "descrição da garantia do objeto/serviço ou 'Não especificada'",
  "objectDescription": "descrição clara e objetiva do objeto licitado",
  "deliveryLocation": "local de entrega ou execução",
  "deliveryDeadline": "prazo de entrega ou execução"
}`;
  }

  private parseClaudeResponse(rawText: string): ClaudeAnalysisResult {
    try {
      // Strip markdown code fences if present
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonText = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
      const parsed = JSON.parse(jsonText) as Partial<ClaudeAnalysisResult>;

      return {
        riskLevel: (['low', 'medium', 'high'].includes(parsed.riskLevel as string)
          ? parsed.riskLevel
          : 'medium') as 'low' | 'medium' | 'high',
        recommendation: (
          ['participate', 'caution', 'avoid'].includes(parsed.recommendation as string)
            ? parsed.recommendation
            : 'caution'
        ) as 'participate' | 'caution' | 'avoid',
        executiveSummary: parsed.executiveSummary ?? 'Análise não disponível.',
        documentAlerts: Array.isArray(parsed.documentAlerts) ? parsed.documentAlerts : [],
        impugnationPoints: Array.isArray(parsed.impugnationPoints)
          ? parsed.impugnationPoints
          : [],
        paymentConditions: parsed.paymentConditions ?? {
          deadline: 'Não informado',
          method: 'Não informado',
          details: '',
        },
        guaranteeContractual: parsed.guaranteeContractual ?? 'Não especificada',
        guaranteeObject: parsed.guaranteeObject ?? 'Não especificada',
        objectDescription: parsed.objectDescription ?? '',
        deliveryLocation: parsed.deliveryLocation ?? '',
        deliveryDeadline: parsed.deliveryDeadline ?? '',
      };
    } catch (err) {
      this.logger.error(`Failed to parse Claude response: ${err instanceof Error ? err.message : String(err)}`);
      return {
        riskLevel: 'medium',
        recommendation: 'caution',
        executiveSummary: 'Não foi possível processar a análise automática. Verifique os dados do edital.',
        documentAlerts: [],
        impugnationPoints: [],
        paymentConditions: { deadline: 'Não informado', method: 'Não informado', details: '' },
        guaranteeContractual: 'Não especificada',
        guaranteeObject: 'Não especificada',
        objectDescription: '',
        deliveryLocation: '',
        deliveryDeadline: '',
      };
    }
  }
}
