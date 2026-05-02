import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create TAED Admin tenant
  const taedTenant = await prisma.tenant.upsert({
    where: { cnpj: '00.000.000/0001-00' },
    update: {},
    create: {
      corporateName: 'TAED Soluções Ltda',
      tradeName: 'TAED Soluções',
      cnpj: '00.000.000/0001-00',
      status: 'active',
      contactName: 'Admin TAED',
      contactEmail: 'admin@taed.com.br',
      contactPhone: '(11) 99999-0000',
      planType: 'admin',
    },
  });

  console.log(`TAED tenant created: ${taedTenant.id}`);

  // 2. Create TAED Admin user
  const hashedPassword = await bcrypt.hash('Admin@123', 12);

  const taedAdmin = await prisma.user.upsert({
    where: { email: 'admin@taed.com.br' },
    update: {},
    create: {
      tenantId: taedTenant.id,
      role: 'taed_admin',
      fullName: 'Administrador TAED',
      email: 'admin@taed.com.br',
      passwordHash: hashedPassword,
      phone: '(11) 99999-0000',
      isActive: true,
    },
  });

  console.log(`TAED admin user created: ${taedAdmin.id}`);

  // 3. Create TAED Operator user
  const taedOperator = await prisma.user.upsert({
    where: { email: 'operador@taed.com.br' },
    update: {},
    create: {
      tenantId: taedTenant.id,
      role: 'taed_operator',
      fullName: 'Operador TAED',
      email: 'operador@taed.com.br',
      passwordHash: hashedPassword,
      phone: '(11) 99999-0001',
      isActive: true,
    },
  });

  console.log(`TAED operator user created: ${taedOperator.id}`);

  // ============================================================
  // EMPRESA 1: Construmax SP — materiais de construção — região SP
  // ============================================================
  const construmax = await prisma.tenant.upsert({
    where: { cnpj: '12.345.678/0001-01' },
    update: {},
    create: {
      corporateName: 'Construmax Soluções em Materiais Ltda',
      tradeName: 'Construmax SP',
      cnpj: '12.345.678/0001-01',
      status: 'active',
      contactName: 'Carlos Pereira',
      contactEmail: 'carlos@construmax.com.br',
      contactPhone: '(11) 97000-0001',
      whatsappNumber: '5511970000001',
      planType: 'basic',
    },
  });

  console.log(`Construmax tenant created: ${construmax.id}`);

  await prisma.user.upsert({
    where: { email: 'carlos@construmax.com.br' },
    update: {},
    create: {
      tenantId: construmax.id,
      role: 'tenant_owner',
      fullName: 'Carlos Pereira',
      email: 'carlos@construmax.com.br',
      passwordHash: hashedPassword,
      phone: '(11) 97000-0001',
      isActive: true,
    },
  });

  await prisma.companyKeyword.createMany({
    data: [
      {
        tenantId: construmax.id,
        keyword: 'Material de construção',
        normalizedKeyword: 'material de construcao',
        matchType: 'include',
        weight: 2.0,
      },
      {
        tenantId: construmax.id,
        keyword: 'Cimento',
        normalizedKeyword: 'cimento',
        matchType: 'include',
        weight: 1.8,
      },
      {
        tenantId: construmax.id,
        keyword: 'Argamassa',
        normalizedKeyword: 'argamassa',
        matchType: 'include',
        weight: 1.5,
      },
      {
        tenantId: construmax.id,
        keyword: 'Tinta acrílica',
        normalizedKeyword: 'tinta acrilica',
        matchType: 'include',
        weight: 1.5,
      },
      {
        tenantId: construmax.id,
        keyword: 'Tubo PVC',
        normalizedKeyword: 'tubo pvc',
        matchType: 'include',
        weight: 1.3,
      },
      {
        tenantId: construmax.id,
        keyword: 'Fio elétrico',
        normalizedKeyword: 'fio eletrico',
        matchType: 'include',
        weight: 1.2,
      },
      {
        tenantId: construmax.id,
        keyword: 'Manutenção predial',
        normalizedKeyword: 'manutencao predial',
        matchType: 'include',
        weight: 1.0,
      },
      {
        tenantId: construmax.id,
        keyword: 'Veículos',
        normalizedKeyword: 'veiculos',
        matchType: 'exclude',
        weight: 1.0,
      },
      {
        tenantId: construmax.id,
        keyword: 'Gêneros alimentícios',
        normalizedKeyword: 'generos alimenticios',
        matchType: 'exclude',
        weight: 1.0,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.companyRegion.createMany({
    data: [
      {
        tenantId: construmax.id,
        uf: 'SP',
        scopeType: 'uf',
      },
    ],
    skipDuplicates: true,
  });

  console.log('Construmax keywords and regions created');

  // ============================================================
  // EMPRESA 2: TechRio — TI e informática — região RJ (município)
  // ============================================================
  const techrio = await prisma.tenant.upsert({
    where: { cnpj: '23.456.789/0001-02' },
    update: {},
    create: {
      corporateName: 'TechRio Soluções em Tecnologia Ltda',
      tradeName: 'TechRio',
      cnpj: '23.456.789/0001-02',
      status: 'active',
      contactName: 'Fernanda Lima',
      contactEmail: 'fernanda@techrio.com.br',
      contactPhone: '(21) 98000-0002',
      whatsappNumber: '5521980000002',
      planType: 'basic',
    },
  });

  console.log(`TechRio tenant created: ${techrio.id}`);

  await prisma.user.upsert({
    where: { email: 'fernanda@techrio.com.br' },
    update: {},
    create: {
      tenantId: techrio.id,
      role: 'tenant_owner',
      fullName: 'Fernanda Lima',
      email: 'fernanda@techrio.com.br',
      passwordHash: hashedPassword,
      phone: '(21) 98000-0002',
      isActive: true,
    },
  });

  await prisma.companyKeyword.createMany({
    data: [
      {
        tenantId: techrio.id,
        keyword: 'Informática',
        normalizedKeyword: 'informatica',
        matchType: 'include',
        weight: 2.0,
      },
      {
        tenantId: techrio.id,
        keyword: 'Computador',
        normalizedKeyword: 'computador',
        matchType: 'include',
        weight: 1.8,
      },
      {
        tenantId: techrio.id,
        keyword: 'Notebook',
        normalizedKeyword: 'notebook',
        matchType: 'include',
        weight: 1.8,
      },
      {
        tenantId: techrio.id,
        keyword: 'Equipamentos de TI',
        normalizedKeyword: 'equipamentos de ti',
        matchType: 'include',
        weight: 1.5,
      },
      {
        tenantId: techrio.id,
        keyword: 'Suporte técnico',
        normalizedKeyword: 'suporte tecnico',
        matchType: 'include',
        weight: 1.5,
      },
      {
        tenantId: techrio.id,
        keyword: 'Switch',
        normalizedKeyword: 'switch',
        matchType: 'include',
        weight: 1.2,
      },
      {
        tenantId: techrio.id,
        keyword: 'Monitor',
        normalizedKeyword: 'monitor',
        matchType: 'include',
        weight: 1.2,
      },
      {
        tenantId: techrio.id,
        keyword: 'Limpeza',
        normalizedKeyword: 'limpeza',
        matchType: 'exclude',
        weight: 1.0,
      },
      {
        tenantId: techrio.id,
        keyword: 'Construção',
        normalizedKeyword: 'construcao',
        matchType: 'exclude',
        weight: 1.0,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.companyRegion.createMany({
    data: [
      {
        tenantId: techrio.id,
        uf: 'RJ',
        municipalityName: 'Rio de Janeiro',
        municipalityIbgeCode: '3304557',
        scopeType: 'municipio',
      },
    ],
    skipDuplicates: true,
  });

  console.log('TechRio keywords and regions created');

  // ============================================================
  // EMPRESA 3: LimpaFácil MG — limpeza e higienização — região MG
  // ============================================================
  const limpafacil = await prisma.tenant.upsert({
    where: { cnpj: '34.567.890/0001-03' },
    update: {},
    create: {
      corporateName: 'LimpaFácil Serviços de Limpeza Ltda',
      tradeName: 'LimpaFácil MG',
      cnpj: '34.567.890/0001-03',
      status: 'active',
      contactName: 'Roberto Souza',
      contactEmail: 'roberto@limpafacil.com.br',
      contactPhone: '(31) 96000-0003',
      whatsappNumber: '5531960000003',
      planType: 'basic',
    },
  });

  console.log(`LimpaFácil tenant created: ${limpafacil.id}`);

  await prisma.user.upsert({
    where: { email: 'roberto@limpafacil.com.br' },
    update: {},
    create: {
      tenantId: limpafacil.id,
      role: 'tenant_owner',
      fullName: 'Roberto Souza',
      email: 'roberto@limpafacil.com.br',
      passwordHash: hashedPassword,
      phone: '(31) 96000-0003',
      isActive: true,
    },
  });

  await prisma.companyKeyword.createMany({
    data: [
      {
        tenantId: limpafacil.id,
        keyword: 'Limpeza',
        normalizedKeyword: 'limpeza',
        matchType: 'include',
        weight: 2.0,
      },
      {
        tenantId: limpafacil.id,
        keyword: 'Higienização',
        normalizedKeyword: 'higienizacao',
        matchType: 'include',
        weight: 1.8,
      },
      {
        tenantId: limpafacil.id,
        keyword: 'Serviços de limpeza',
        normalizedKeyword: 'servicos de limpeza',
        matchType: 'include',
        weight: 2.0,
      },
      {
        tenantId: limpafacil.id,
        keyword: 'Material de limpeza',
        normalizedKeyword: 'material de limpeza',
        matchType: 'include',
        weight: 1.8,
      },
      {
        tenantId: limpafacil.id,
        keyword: 'Conservação predial',
        normalizedKeyword: 'conservacao predial',
        matchType: 'include',
        weight: 1.5,
      },
      {
        tenantId: limpafacil.id,
        keyword: 'Detergente',
        normalizedKeyword: 'detergente',
        matchType: 'include',
        weight: 1.2,
      },
      {
        tenantId: limpafacil.id,
        keyword: 'Papel higiênico',
        normalizedKeyword: 'papel higienico',
        matchType: 'include',
        weight: 1.0,
      },
      {
        tenantId: limpafacil.id,
        keyword: 'Informática',
        normalizedKeyword: 'informatica',
        matchType: 'exclude',
        weight: 1.0,
      },
      {
        tenantId: limpafacil.id,
        keyword: 'Veículos',
        normalizedKeyword: 'veiculos',
        matchType: 'exclude',
        weight: 1.0,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.companyRegion.createMany({
    data: [
      {
        tenantId: limpafacil.id,
        uf: 'MG',
        scopeType: 'uf',
      },
    ],
    skipDuplicates: true,
  });

  console.log('LimpaFácil keywords and regions created');

  // ============================================================
  // NEW: CompanyFilter, Documents, Results for each tenant
  // ============================================================

  // CompanyFilter for Construmax
  await prisma.companyFilter.upsert({
    where: { tenantId: construmax.id },
    update: {},
    create: {
      tenantId: construmax.id,
      municipioBase: 'São Paulo',
      raioKm: 100,
      participaMunicipal: true,
      participaEstadual: true,
      participaFederal: false,
      participaAutarquias: false,
      modalidadePregao: true,
      modalidadeDispensa: true,
      modalidadeOutros: false,
      notificaEmail: true,
      notificaWhatsapp: true,
      notificaPush: true,
    },
  });

  // CompanyFilter for TechRio
  await prisma.companyFilter.upsert({
    where: { tenantId: techrio.id },
    update: {},
    create: {
      tenantId: techrio.id,
      municipioBase: 'Rio de Janeiro',
      raioKm: 50,
      participaMunicipal: true,
      participaEstadual: true,
      participaFederal: true,
      participaAutarquias: true,
      modalidadePregao: true,
      modalidadeDispensa: false,
      modalidadeOutros: false,
      notificaEmail: true,
      notificaWhatsapp: false,
      notificaPush: true,
    },
  });

  // CompanyFilter for LimpaFacil
  await prisma.companyFilter.upsert({
    where: { tenantId: limpafacil.id },
    update: {},
    create: {
      tenantId: limpafacil.id,
      municipioBase: 'Belo Horizonte',
      raioKm: 75,
      participaMunicipal: true,
      participaEstadual: true,
      participaFederal: false,
      participaAutarquias: false,
      modalidadePregao: true,
      modalidadeDispensa: true,
      modalidadeOutros: true,
      notificaEmail: true,
      notificaWhatsapp: true,
      notificaPush: false,
    },
  });

  console.log('CompanyFilters created');

  // Documents for each tenant
  const now = new Date();

  await prisma.document.createMany({
    data: [
      // Construmax docs
      {
        tenantId: construmax.id,
        type: 'Certidão Negativa Federal',
        status: 'valida',
        validUntil: new Date(now.getTime() + 60 * 86400000),
        fileUrl: null,
      },
      {
        tenantId: construmax.id,
        type: 'Certidão Negativa Estadual',
        status: 'a_vencer',
        validUntil: new Date(now.getTime() + 10 * 86400000),
        fileUrl: null,
      },
      {
        tenantId: construmax.id,
        type: 'FGTS',
        status: 'vencida',
        validUntil: new Date(now.getTime() - 5 * 86400000),
        fileUrl: null,
      },
      // TechRio docs
      {
        tenantId: techrio.id,
        type: 'Certidão Negativa Federal',
        status: 'valida',
        validUntil: new Date(now.getTime() + 90 * 86400000),
        fileUrl: null,
      },
      {
        tenantId: techrio.id,
        type: 'Certidão Negativa Municipal',
        status: 'a_vencer',
        validUntil: new Date(now.getTime() + 7 * 86400000),
        fileUrl: null,
      },
      // LimpaFacil docs
      {
        tenantId: limpafacil.id,
        type: 'Certidão Negativa Federal',
        status: 'valida',
        validUntil: new Date(now.getTime() + 45 * 86400000),
        fileUrl: null,
      },
      {
        tenantId: limpafacil.id,
        type: 'INSS',
        status: 'a_vencer',
        validUntil: new Date(now.getTime() + 15 * 86400000),
        fileUrl: null,
      },
    ],
    skipDuplicates: false,
  });

  console.log('Documents created');

  // Results for each tenant (using placeholder biddingId since no real biddings in seed)
  const fakeBiddingId = '00000000-0000-0000-0000-000000000001';

  await prisma.result.createMany({
    data: [
      {
        tenantId: construmax.id,
        biddingId: fakeBiddingId,
        status: 'ganhou',
        valorContrato: 125000.0,
        prazoEntrega: new Date(now.getTime() + 30 * 86400000),
        obrigacoes: 'Entrega de materiais de construção conforme edital.',
      },
      {
        tenantId: construmax.id,
        biddingId: fakeBiddingId,
        status: 'perdeu',
        valorContrato: null,
        prazoEntrega: null,
        obrigacoes: null,
      },
      {
        tenantId: techrio.id,
        biddingId: fakeBiddingId,
        status: 'ganhou',
        valorContrato: 87500.0,
        prazoEntrega: new Date(now.getTime() + 45 * 86400000),
        obrigacoes: 'Fornecimento de equipamentos de TI conforme especificações.',
      },
      {
        tenantId: techrio.id,
        biddingId: fakeBiddingId,
        status: 'ganhou',
        valorContrato: 45000.0,
        prazoEntrega: new Date(now.getTime() + 60 * 86400000),
        obrigacoes: 'Suporte técnico e manutenção de servidores.',
      },
      {
        tenantId: limpafacil.id,
        biddingId: fakeBiddingId,
        status: 'perdeu',
        valorContrato: null,
        prazoEntrega: null,
        obrigacoes: null,
      },
      {
        tenantId: limpafacil.id,
        biddingId: fakeBiddingId,
        status: 'ganhou',
        valorContrato: 32000.0,
        prazoEntrega: new Date(now.getTime() + 90 * 86400000),
        obrigacoes: 'Serviços mensais de limpeza e higienização.',
      },
    ],
    skipDuplicates: false,
  });

  console.log('Results created');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
