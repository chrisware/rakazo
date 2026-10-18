-- Optional model that summarizes a reply before any voice speaks it.
ALTER TABLE "bots" ADD COLUMN "speakMode" TEXT NOT NULL DEFAULT 'full';
ALTER TABLE "messages" ADD COLUMN "spokenSummary" TEXT;

CREATE TABLE "speech_summary_configs" (
  "spaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "secretId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "speech_summary_configs_pkey" PRIMARY KEY ("spaceId", "userId")
);

ALTER TABLE "speech_summary_configs"
  ADD CONSTRAINT "speech_summary_configs_spaceId_userId_fkey"
  FOREIGN KEY ("spaceId", "userId") REFERENCES "space_members"("spaceId", "userId")
  ON DELETE CASCADE ON UPDATE CASCADE;
