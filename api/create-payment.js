const { randomUUID } = require("node:crypto");

const ObyPayEndpoint = "https://api.obypay.app/transactions";

module.exports = async function createPayment(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.OBYPAY_ENABLED !== "true") {
    return res.status(503).json({
      error: "Checkout is not enabled until the offer is configured.",
      code: "CHECKOUT_DISABLED",
    });
  }

  const apiKey = process.env.OBYPAY_API_KEY;
  const amountText = process.env.OBYPAY_OFFER_AMOUNT_CENTS;
  const description = process.env.OBYPAY_OFFER_DESCRIPTION?.trim();
  const storeUrl = process.env.OBYPAY_STORE_URL;
  const amount = Number(amountText);

  if (
    !apiKey ||
    !/^[1-9]\d*$/.test(amountText || "") ||
    !Number.isSafeInteger(amount) ||
    amount < 50 ||
    !description ||
    description.length > 140
  ) {
    return res.status(503).json({
      error: "The payment server is missing valid offer configuration.",
      code: "CHECKOUT_NOT_CONFIGURED",
    });
  }

  if (storeUrl) {
    try {
      if (new URL(storeUrl).protocol !== "https:") {
        throw new Error("Store URL must use HTTPS");
      }
    } catch {
      return res.status(503).json({
        error: "The configured store URL must be a valid HTTPS URL.",
        code: "INVALID_STORE_URL",
      });
    }
  }

  const requestBody = {
    amount,
    description,
    externalId: randomUUID(),
  };

  if (storeUrl) {
    requestBody.storeUrl = storeUrl;
  }

  let providerResponse;
  try {
    providerResponse = await fetch(ObyPayEndpoint, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    console.error("ObyPay request failed", error);
    return res.status(502).json({
      error: "Could not reach the payment provider. Please try again.",
      code: "PAYMENT_PROVIDER_UNAVAILABLE",
    });
  }

  let payment;
  try {
    payment = await providerResponse.json();
  } catch (error) {
    console.error("ObyPay returned an invalid JSON response", error);
    return res.status(502).json({
      error: "The payment provider returned an invalid response.",
      code: "INVALID_PROVIDER_RESPONSE",
    });
  }

  if (!providerResponse.ok) {
    const providerCode =
      typeof payment.code === "string" ? payment.code : "PROVIDER_ERROR";
    console.error("ObyPay rejected the payment request", {
      status: providerResponse.status,
      code: providerCode,
    });
    return res.status(502).json({
      error: "The payment provider could not create the PIX charge.",
      code: providerCode,
    });
  }

  if (
    typeof payment.id !== "string" ||
    typeof payment.qrCodeBase64 !== "string" ||
    typeof payment.copyPaste !== "string"
  ) {
    console.error("ObyPay response is missing PIX payment details");
    return res.status(502).json({
      error: "The payment provider response is missing PIX payment details.",
      code: "INCOMPLETE_PROVIDER_RESPONSE",
    });
  }

  return res.status(200).json({
    id: payment.id,
    status: payment.status,
    amount: payment.amount,
    qrCodeBase64: payment.qrCodeBase64,
    copyPaste: payment.copyPaste,
    expiresAt: payment.expiresAt,
  });
};
