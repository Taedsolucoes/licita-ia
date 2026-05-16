-- CreateTable: company_cnaes
CREATE TABLE "company_cnaes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "description" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "company_cnaes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: habilitation_documents
CREATE TABLE "habilitation_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "origin" VARCHAR(30) NOT NULL,
    "external_link" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "valid_until" TIMESTAMP(3),
    "file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habilitation_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_cnaes_tenant_id_idx" ON "company_cnaes"("tenant_id");

-- CreateIndex
CREATE INDEX "habilitation_documents_tenant_id_idx" ON "habilitation_documents"("tenant_id");

-- AddForeignKey
ALTER TABLE "company_cnaes" ADD CONSTRAINT "company_cnaes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habilitation_documents" ADD CONSTRAINT "habilitation_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
