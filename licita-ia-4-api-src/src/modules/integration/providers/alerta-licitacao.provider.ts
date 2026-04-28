import { Injectable, Logger } from '@nestjs/common';
import {
  BiddingSourceProvider,
  BiddingSourceRaw,
  BiddingItemRaw,
  FetchBiddingsOptions,
  FetchBiddingsResult,
} from './bidding-source.provider';

/**
 * Mock/seed provider that returns realistic Brazilian bidding data.
 * Will be replaced by real AlertaLicitacao API integration when credentials are available.
 */
@Injectable()
export class AlertaLicitacaoProvider implements BiddingSourceProvider {
  private readonly logger = new Logger(AlertaLicitacaoProvider.name);
  readonly sourceName = 'alertalicitacao';

  async fetchBiddings(options?: FetchBiddingsOptions): Promise<FetchBiddingsResult> {
    this.logger.log(`Fetching biddings (mock) cursor=${options?.cursor || 'none'}`);
    const biddings = this.getMockBiddings();

    const cursor = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const limit = options?.limit || 50;
    const slice = biddings.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < biddings.length ? String(cursor + limit) : null;

    return {
      biddings: slice,
      nextCursor,
      totalFetched: slice.length,
    };
  }

  async fetchBiddingDetails(externalId: string): Promise<BiddingSourceRaw | null> {
    const all = this.getMockBiddings();
    return all.find((b) => b.externalId === externalId) || null;
  }

  async fetchBiddingItems(externalId: string): Promise<BiddingItemRaw[]> {
    const bidding = await this.fetchBiddingDetails(externalId);
    return bidding?.items || [];
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    return { healthy: true, message: 'Mock provider is always healthy' };
  }

  private getMockBiddings(): BiddingSourceRaw[] {
    return [
      // 1 - Materiais de escritorio / informatica - SP
      {
        externalId: 'AL-2025-001',
        biddingNumber: 'PE 001/2025',
        modality: 'Pregão Eletrônico',
        uasg: '153045',
        sphere: 'Federal',
        agencyName: 'Universidade Federal de São Paulo - UNIFESP',
        agencyDocument: '60.453.032/0001-74',
        objectText: 'Aquisição de material de escritório e suprimentos de informática, incluindo papel A4, toner para impressora, canetas, pastas, pen drives e mouses para atender as necessidades da administração central.',
        objectSummary: 'Material de escritório e informática para UNIFESP',
        sourceUrl: 'https://alertalicitacao.com.br/licitacao/AL-2025-001',
        publicationDate: new Date('2025-04-10'),
        openingDate: new Date('2025-04-28'),
        proposalDueDate: new Date('2025-04-27'),
        estimatedValue: 185000.00,
        municipalityName: 'São Paulo',
        municipalityIbgeCode: '3550308',
        uf: 'SP',
        status: 'open',
        rawPayload: { source: 'mock', version: '1.0' },
        items: [
          { itemNumber: 1, description: 'Papel A4 75g/m² - resma 500 folhas', quantity: 500, unit: 'Resma', unitValueEstimated: 28.50, totalValueEstimated: 14250.00, catalogCode: 'CATMAT-440001', rawPayload: {} },
          { itemNumber: 2, description: 'Toner HP CF226A compatível para impressora LaserJet', quantity: 100, unit: 'Unidade', unitValueEstimated: 189.90, totalValueEstimated: 18990.00, catalogCode: 'CATMAT-440025', rawPayload: {} },
          { itemNumber: 3, description: 'Mouse óptico USB ergonômico', quantity: 200, unit: 'Unidade', unitValueEstimated: 35.00, totalValueEstimated: 7000.00, catalogCode: 'CATMAT-449021', rawPayload: {} },
          { itemNumber: 4, description: 'Pen drive 64GB USB 3.0', quantity: 150, unit: 'Unidade', unitValueEstimated: 49.90, totalValueEstimated: 7485.00, catalogCode: 'CATMAT-449030', rawPayload: {} },
          { itemNumber: 5, description: 'Caneta esferográfica azul caixa com 50 unidades', quantity: 100, unit: 'Caixa', unitValueEstimated: 42.00, totalValueEstimated: 4200.00, catalogCode: 'CATMAT-440005', rawPayload: {} },
        ],
      },
      // 2 - Equipamentos de TI - RJ
      {
        externalId: 'AL-2025-002',
        biddingNumber: 'PE 015/2025',
        modality: 'Pregão Eletrônico',
        uasg: '110161',
        sphere: 'Federal',
        agencyName: 'Tribunal Regional Federal da 2ª Região',
        agencyDocument: '05.765.003/0001-06',
        objectText: 'Aquisição de computadores desktop, notebooks, monitores LED e equipamentos de rede, incluindo switches gerenciáveis e access points para modernização do parque tecnológico.',
        objectSummary: 'Equipamentos de TI para o TRF-2',
        sourceUrl: 'https://alertalicitacao.com.br/licitacao/AL-2025-002',
        publicationDate: new Date('2025-04-12'),
        openingDate: new Date('2025-05-02'),
        proposalDueDate: new Date('2025-05-01'),
        estimatedValue: 1250000.00,
        municipalityName: 'Rio de Janeiro',
        municipalityIbgeCode: '3304557',
        uf: 'RJ',
        status: 'open',
        rawPayload: { source: 'mock', version: '1.0' },
        items: [
          { itemNumber: 1, description: 'Computador desktop Intel Core i7, 16GB RAM, SSD 512GB, Windows 11 Pro', quantity: 50, unit: 'Unidade', unitValueEstimated: 5800.00, totalValueEstimated: 290000.00, catalogCode: 'CATMAT-449010', rawPayload: {} },
          { itemNumber: 2, description: 'Notebook 15.6" Intel Core i7, 16GB RAM, SSD 512GB, Windows 11 Pro', quantity: 30, unit: 'Unidade', unitValueEstimated: 7200.00, totalValueEstimated: 216000.00, catalogCode: 'CATMAT-449012', rawPayload: {} },
          { itemNumber: 3, description: 'Monitor LED 27" Full HD IPS', quantity: 80, unit: 'Unidade', unitValueEstimated: 1350.00, totalValueEstimated: 108000.00, catalogCode: 'CATMAT-449015', rawPayload: {} },
          { itemNumber: 4, description: 'Switch gerenciável 48 portas Gigabit PoE+', quantity: 10, unit: 'Unidade', unitValueEstimated: 8500.00, totalValueEstimated: 85000.00, catalogCode: 'CATMAT-449040', rawPayload: {} },
        ],
      },
      // 3 - Servicos de limpeza - MG
      {
        externalId: 'AL-2025-003',
        biddingNumber: 'PE 008/2025',
        modality: 'Pregão Eletrônico',
        uasg: '170010',
        sphere: 'Federal',
        agencyName: 'Ministério da Fazenda - Superintendência Regional MG',
        agencyDocument: '00.394.460/0149-04',
        objectText: 'Contratação de serviços continuados de limpeza, conservação e higienização predial com fornecimento de materiais e equipamentos para as dependências da Superintendência Regional em Belo Horizonte.',
        objectSummary: 'Serviços de limpeza predial em BH',
        sourceUrl: 'https://alertalicitacao.com.br/licitacao/AL-2025-003',
        publicationDate: new Date('2025-04-08'),
        openingDate: new Date('2025-04-25'),
        proposalDueDate: new Date('2025-04-24'),
        estimatedValue: 720000.00,
        municipalityName: 'Belo Horizonte',
        municipalityIbgeCode: '3106200',
        uf: 'MG',
        status: 'open',
        rawPayload: { source: 'mock', version: '1.0' },
        items: [
          { itemNumber: 1, description: 'Servente de limpeza - posto diurno 44h semanais', quantity: 10, unit: 'Posto', unitValueEstimated: 4500.00, totalValueEstimated: 540000.00, catalogCode: null, rawPayload: {} },
          { itemNumber: 2, description: 'Encarregado de limpeza - posto diurno 44h semanais', quantity: 2, unit: 'Posto', unitValueEstimated: 6500.00, totalValueEstimated: 156000.00, catalogCode: null, rawPayload: {} },
        ],
      },
      // 4 - Materiais de construcao - SP
      {
        externalId: 'AL-2025-004',
        biddingNumber: 'PE 022/2025',
        modality: 'Pregão Eletrônico',
        uasg: '160088',
        sphere: 'Federal',
        agencyName: '2ª Região Militar - Comando Militar do Sudeste',
        agencyDocument: '09.543.234/0001-13',
        objectText: 'Aquisição de materiais de construção para manutenção predial: cimento, argamassa, tintas, tubos PVC, fios elétricos, disjuntores, ferramentas manuais e equipamentos de segurança.',
        objectSummary: 'Materiais de construção para manutenção predial',
        sourceUrl: 'https://alertalicitacao.com.br/licitacao/AL-2025-004',
        publicationDate: new Date('2025-04-15'),
        openingDate: new Date('2025-05-05'),
        proposalDueDate: new Date('2025-05-04'),
        estimatedValue: 350000.00,
        municipalityName: 'São Paulo',
        municipalityIbgeCode: '3550308',
        uf: 'SP',
        status: 'open',
        rawPayload: { source: 'mock', version: '1.0' },
        items: [
          { itemNumber: 1, description: 'Cimento Portland CP-II 50kg', quantity: 500, unit: 'Saco', unitValueEstimated: 38.00, totalValueEstimated: 19000.00, catalogCode: 'CATMAT-460001', rawPayload: {} },
          { itemNumber: 2, description: 'Tinta acrílica branca premium 18L', quantity: 200, unit: 'Lata', unitValueEstimated: 289.00, totalValueEstimated: 57800.00, catalogCode: 'CATMAT-460050', rawPayload: {} },
          { itemNumber: 3, description: 'Tubo PVC soldável 50mm - 6m', quantity: 300, unit: 'Barra', unitValueEstimated: 32.50, totalValueEstimated: 9750.00, catalogCode: 'CATMAT-460030', rawPayload: {} },
          { itemNumber: 4, description: 'Fio elétrico flexível 2,5mm² 100m', quantity: 100, unit: 'Rolo', unitValueEstimated: 185.00, totalValueEstimated: 18500.00, catalogCode: 'CATMAT-460040', rawPayload: {} },
        ],
      },
      // 5 - Mobiliario - SP
      {
        externalId: 'AL-2025-005',
        biddingNumber: 'PE 030/2025',
        modality: 'Pregão Eletrônico',
        uasg: '154043',
        sphere: 'Federal',
        agencyName: 'Instituto Federal de Educação, Ciência e Tecnologia de São Paulo',
        agencyDocument: '10.882.594/0001-65',
        objectText: 'Aquisição de mobiliário escolar e de escritório: mesas, cadeiras giratórias, armários, estantes de aço e gaveteiros para atender os campi do IFSP.',
        objectSummary: 'Mobiliário escolar e de escritório para IFSP',
        sourceUrl: 'https://alertalicitacao.com.br/licitacao/AL-2025-005',
        publicationDate: new Date('2025-04-18'),
        openingDate: new Date('2025-05-08'),
        proposalDueDate: new Date('2025-05-07'),
        estimatedValue: 480000.00,
        municipalityName: 'São Paulo',
        municipalityIbgeCode: '3550308',
        uf: 'SP',
        status: 'open',
        rawPayload: { source: 'mock', version: '1.0' },
        items: [
          { itemNumber: 1, description: 'Mesa de escritório em L 1,50x1,50m com gaveteiro', quantity: 60, unit: 'Unidade', unitValueEstimated: 1200.00, totalValueEstimated: 72000.00, catalogCode: null, rawPayload: {} },
          { itemNumber: 2, description: 'Cadeira giratória presidente com apoio lombar', quantity: 60, unit: 'Unidade', unitValueEstimated: 850.00, totalValueEstimated: 51000.00, catalogCode: null, rawPayload: {} },
          { itemNumber: 3, description: 'Armário de aço 2 portas com 4 prateleiras', quantity: 40, unit: 'Unidade', unitValueEstimated: 780.00, totalValueEstimated: 31200.00, catalogCode: null, rawPayload: {} },
        ],
      },
      // 6 - Generos alimenticios - RJ
      {
        externalId: 'AL-2025-006',
        biddingNumber: 'PE 012/2025',
        modality: 'Pregão Eletrônico',
        uasg: '158157',
        sphere: 'Federal',
        agencyName: 'Colégio Pedro II',
        agencyDocument: '42.498.600/0001-48',
        objectText: 'Aquisição de gêneros alimentícios para merenda escolar: arroz, feijão, óleo de soja, açúcar, leite integral, frutas e verduras para abastecimento das unidades escolares.',
        objectSummary: 'Gêneros alimentícios para merenda escolar',
        sourceUrl: 'https://alertalicitacao.com.br/licitacao/AL-2025-006',
        publicationDate: new Date('2025-04-11'),
        openingDate: new Date('2025-04-29'),
        proposalDueDate: new Date('2025-04-28'),
        estimatedValue: 890000.00,
        municipalityName: 'Rio de Janeiro',
        municipalityIbgeCode: '3304557',
        uf: 'RJ',
        status: 'open',
        rawPayload: { source: 'mock', version: '1.0' },
        items: [
          { itemNumber: 1, description: 'Arroz tipo 1 longo fino - pacote 5kg', quantity: 2000, unit: 'Pacote', unitValueEstimated: 22.90, totalValueEstimated: 45800.00, catalogCode: null, rawPayload: {} },
          { itemNumber: 2, description: 'Feijão carioca tipo 1 - pacote 1kg', quantity: 3000, unit: 'Pacote', unitValueEstimated: 8.50, totalValueEstimated: 25500.00, catalogCode: null, rawPayload: {} },
          { itemNumber: 3, description: 'Leite integral UHT 1L', quantity: 5000, unit: 'Unidade', unitValueEstimated: 5.90, totalValueEstimated: 29500.00, catalogCode: null, rawPayload: {} },
        ],
      },
      // 7 - Equipamentos medicos/hospitalares - MG
      {
        externalId: 'AL-2025-007',
        biddingNumber: 'PE 019/2025',
        modality: 'Pregão Eletrônico',
        uasg: '250110',
        sphere: 'Federal',
        agencyName: 'Hospital das Clínicas - UFMG',
        agencyDocument: '17.217.985/0001-04',
        objectText: 'Aquisição de equipamentos médico-hospitalares: monitores multiparamétricos, oxímetros de pulso, desfibriladores e bomba de infusão para as unidades de terapia intensiva.',
        objectSummary: 'Equipamentos médico-hospitalares para UTI',
        sourceUrl: 'https://alertalicitacao.com.br/licitacao/AL-2025-007',
        publicationDate: new Date('2025-04-14'),
        openingDate: new Date('2025-05-06'),
        proposalDueDate: new Date('2025-05-05'),
        estimatedValue: 2100000.00,
        municipalityName: 'Belo Horizonte',
        municipalityIbgeCode: '3106200',
        uf: 'MG',
        status: 'open',
        rawPayload: { source: 'mock', version: '1.0' },
        items: [
          { itemNumber: 1, description: 'Monitor multiparamétrico com tela 15" touch', quantity: 10, unit: 'Unidade', unitValueEstimated: 45000.00, totalValueEstimated: 450000.00, catalogCode: null, rawPayload: {} },
          { itemNumber: 2, description: 'Desfibrilador externo automático (DEA)', quantity: 5, unit: 'Unidade', unitValueEstimated: 12000.00, totalValueEstimated: 60000.00, catalogCode: null, rawPayload: {} },
          { itemNumber: 3, description: 'Bomba de infusão volumétrica 2 canais', quantity: 20, unit: 'Unidade', unitValueEstimated: 8500.00, totalValueEstimated: 170000.00, catalogCode: null, rawPayload: {} },
        ],
      },
      // 8 - Servicos de seguranca/vigilancia - SP
      {
        externalId: 'AL-2025-008',
        biddingNumber: 'PE 025/2025',
        modality: 'Pregão Eletrônico',
        uasg: '153038',
        sphere: 'Federal',
        agencyName: 'Universidade de São Paulo - USP',
        agencyDocument: '63.025.530/0001-04',
        objectText: 'Contratação de serviços de vigilância patrimonial armada e desarmada, incluindo monitoramento eletrônico por CFTV, controle de acesso e ronda motorizada para os campi da USP.',
        objectSummary: 'Vigilância patrimonial para USP',
        sourceUrl: 'https://alertalicitacao.com.br/licitacao/AL-2025-008',
        publicationDate: new Date('2025-04-16'),
        openingDate: new Date('2025-05-10'),
        proposalDueDate: new Date('2025-05-09'),
        estimatedValue: 3500000.00,
        municipalityName: 'São Paulo',
        municipalityIbgeCode: '3550308',
        uf: 'SP',
        status: 'open',
        rawPayload: { source: 'mock', version: '1.0' },
        items: [
          { itemNumber: 1, description: 'Vigilante armado - posto diurno 12x36', quantity: 20, unit: 'Posto', unitValueEstimated: 12000.00, totalValueEstimated: 2880000.00, catalogCode: null, rawPayload: {} },
          { itemNumber: 2, description: 'Vigilante desarmado - posto noturno 12x36', quantity: 10, unit: 'Posto', unitValueEstimated: 9500.00, totalValueEstimated: 1140000.00, catalogCode: null, rawPayload: {} },
        ],
      },
      // 9 - Material de limpeza e higiene - RJ
      {
        externalId: 'AL-2025-009',
        biddingNumber: 'PE 033/2025',
        modality: 'Pregão Eletrônico',
        uasg: '158155',
        sphere: 'Federal',
        agencyName: 'Instituto Federal do Rio de Janeiro - IFRJ',
        agencyDocument: '10.952.706/0001-63',
        objectText: 'Aquisição de materiais de limpeza e higienização: detergente, desinfetante, água sanitária, sabão líquido, papel toalha, papel higiênico e sacos de lixo para todas as unidades do IFRJ.',
        objectSummary: 'Materiais de limpeza e higiene para IFRJ',
        sourceUrl: 'https://alertalicitacao.com.br/licitacao/AL-2025-009',
        publicationDate: new Date('2025-04-20'),
        openingDate: new Date('2025-05-12'),
        proposalDueDate: new Date('2025-05-11'),
        estimatedValue: 165000.00,
        municipalityName: 'Rio de Janeiro',
        municipalityIbgeCode: '3304557',
        uf: 'RJ',
        status: 'open',
        rawPayload: { source: 'mock', version: '1.0' },
        items: [
          { itemNumber: 1, description: 'Detergente líquido neutro 500ml', quantity: 1000, unit: 'Unidade', unitValueEstimated: 3.50, totalValueEstimated: 3500.00, catalogCode: null, rawPayload: {} },
          { itemNumber: 2, description: 'Papel higiênico folha dupla 300m - rolo', quantity: 2000, unit: 'Rolo', unitValueEstimated: 12.80, totalValueEstimated: 25600.00, catalogCode: null, rawPayload: {} },
          { itemNumber: 3, description: 'Álcool etílico 70% líquido 1L', quantity: 500, unit: 'Unidade', unitValueEstimated: 9.90, totalValueEstimated: 4950.00, catalogCode: null, rawPayload: {} },
          { itemNumber: 4, description: 'Saco de lixo preto 100L - pacote com 100 unidades', quantity: 200, unit: 'Pacote', unitValueEstimated: 45.00, totalValueEstimated: 9000.00, catalogCode: null, rawPayload: {} },
        ],
      },
      // 10 - Servicos de TI / suporte - SP
      {
        externalId: 'AL-2025-010',
        biddingNumber: 'PE 040/2025',
        modality: 'Pregão Eletrônico',
        uasg: '200100',
        sphere: 'Federal',
        agencyName: 'Secretaria de Governo Digital - SGD/ME',
        agencyDocument: '00.489.828/0003-17',
        objectText: 'Contratação de serviços de suporte técnico em tecnologia da informação e comunicação, incluindo sustentação de infraestrutura de rede, help desk nível 1 e 2, e administração de servidores Linux e Windows.',
        objectSummary: 'Serviços de suporte em TI para SGD',
        sourceUrl: 'https://alertalicitacao.com.br/licitacao/AL-2025-010',
        publicationDate: new Date('2025-04-22'),
        openingDate: new Date('2025-05-15'),
        proposalDueDate: new Date('2025-05-14'),
        estimatedValue: 4800000.00,
        municipalityName: 'Brasília',
        municipalityIbgeCode: '5300108',
        uf: 'DF',
        status: 'open',
        rawPayload: { source: 'mock', version: '1.0' },
        items: [
          { itemNumber: 1, description: 'Analista de suporte técnico nível 2 - posto mensal', quantity: 15, unit: 'Posto', unitValueEstimated: 14000.00, totalValueEstimated: 2520000.00, catalogCode: null, rawPayload: {} },
          { itemNumber: 2, description: 'Técnico de help desk nível 1 - posto mensal', quantity: 20, unit: 'Posto', unitValueEstimated: 8500.00, totalValueEstimated: 2040000.00, catalogCode: null, rawPayload: {} },
        ],
      },
      // 11 - Ar condicionado - SP
      {
        externalId: 'AL-2025-011',
        biddingNumber: 'PE 045/2025',
        modality: 'Pregão Eletrônico',
        uasg: '153040',
        sphere: 'Federal',
        agencyName: 'Universidade Estadual de Campinas - UNICAMP',
        agencyDocument: '46.068.425/0001-33',
        objectText: 'Aquisição e instalação de aparelhos de ar condicionado split inverter e manutenção preventiva e corretiva de equipamentos de climatização existentes nos blocos administrativos.',
        objectSummary: 'Ar condicionado e climatização para UNICAMP',
        sourceUrl: 'https://alertalicitacao.com.br/licitacao/AL-2025-011',
        publicationDate: new Date('2025-04-19'),
        openingDate: new Date('2025-05-09'),
        proposalDueDate: new Date('2025-05-08'),
        estimatedValue: 290000.00,
        municipalityName: 'Campinas',
        municipalityIbgeCode: '3509502',
        uf: 'SP',
        status: 'open',
        rawPayload: { source: 'mock', version: '1.0' },
        items: [
          { itemNumber: 1, description: 'Ar condicionado split inverter 24.000 BTUs', quantity: 30, unit: 'Unidade', unitValueEstimated: 4200.00, totalValueEstimated: 126000.00, catalogCode: null, rawPayload: {} },
          { itemNumber: 2, description: 'Ar condicionado split inverter 12.000 BTUs', quantity: 20, unit: 'Unidade', unitValueEstimated: 2800.00, totalValueEstimated: 56000.00, catalogCode: null, rawPayload: {} },
          { itemNumber: 3, description: 'Serviço de instalação de split com tubulação até 5m', quantity: 50, unit: 'Serviço', unitValueEstimated: 800.00, totalValueEstimated: 40000.00, catalogCode: null, rawPayload: {} },
        ],
      },
      // 12 - Veiculos - MG
      {
        externalId: 'AL-2025-012',
        biddingNumber: 'PE 050/2025',
        modality: 'Pregão Eletrônico',
        uasg: '200005',
        sphere: 'Federal',
        agencyName: 'Polícia Rodoviária Federal - Superintendência MG',
        agencyDocument: '00.394.494/0011-00',
        objectText: 'Aquisição de veículos tipo sedan e tipo SUV para renovação da frota operacional, incluindo adaptação veicular com equipamentos de sinalização e comunicação.',
        objectSummary: 'Veículos para frota operacional da PRF/MG',
        sourceUrl: 'https://alertalicitacao.com.br/licitacao/AL-2025-012',
        publicationDate: new Date('2025-04-21'),
        openingDate: new Date('2025-05-14'),
        proposalDueDate: new Date('2025-05-13'),
        estimatedValue: 5200000.00,
        municipalityName: 'Belo Horizonte',
        municipalityIbgeCode: '3106200',
        uf: 'MG',
        status: 'open',
        rawPayload: { source: 'mock', version: '1.0' },
        items: [
          { itemNumber: 1, description: 'Veículo tipo sedan 2.0 automático com ar condicionado', quantity: 15, unit: 'Unidade', unitValueEstimated: 145000.00, totalValueEstimated: 2175000.00, catalogCode: null, rawPayload: {} },
          { itemNumber: 2, description: 'Veículo tipo SUV 4x4 diesel automático', quantity: 10, unit: 'Unidade', unitValueEstimated: 285000.00, totalValueEstimated: 2850000.00, catalogCode: null, rawPayload: {} },
        ],
      },
    ];
  }
}
