-- CreateTable
CREATE TABLE "company_filters" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "municipioBase" TEXT,
    "raioKm" INTEGER NOT NULL DEFAULT 50,
    "participaMunicipal" BOOLEAN NOT NULL DEFAULT true,
    "participaEstadual" BOOLEAN NOT NULL DEFAULT true,
    "participaFederal" BOOLEAN NOT NULL DEFAULT true,
    "participaAutarquias" BOOLEAN NOT NULL DEFAULT false,
    "modalidadePregao" BOOLEAN NOT NULL DEFAULT true,
    "modalidadeDispensa" BOOLEAN NOT NULL DEFAULT true,
    "modalidadeOutros" BOOLEAN NOT NULL DEFAULT false,
    "notificaEmail" BOOLEAN NOT NULL DEFAULT true,
    "notificaWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "notificaPush" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "company_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3),
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "biddingId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "valorContrato" DECIMAL(65,30),
    "prazoEntrega" TIMESTAMP(3),
    "obrigacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_filters_tenantId_key" ON "company_filters"("tenantId");

-- AddForeignKey
ALTER TABLE "company_filters" ADD CONSTRAINT "company_filters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
