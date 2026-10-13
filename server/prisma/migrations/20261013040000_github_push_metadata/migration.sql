-- Existing pushes have no trustworthy publication time; leave them unknown.
ALTER TABLE "Project" ADD COLUMN "lastPushedAt" TIMESTAMP(3),
ADD COLUMN "lastPushedCommitSha" TEXT;
