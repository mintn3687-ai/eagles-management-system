CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushDelivery" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_token_key" ON "PushSubscription"("token");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE UNIQUE INDEX "PushDelivery_subscriptionId_eventKey_key" ON "PushDelivery"("subscriptionId", "eventKey");
CREATE INDEX "PushDelivery_eventKey_idx" ON "PushDelivery"("eventKey");
