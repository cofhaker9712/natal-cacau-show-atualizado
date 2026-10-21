const deliveryForm = document.querySelector("#delivery-form");
const deliveryStep = document.querySelector("#delivery-step");
const checkoutStep = document.querySelector("#checkout-step");
const deliveryPhone = document.querySelector("#delivery-phone");
const deliveryPostalCode = document.querySelector("#delivery-postal-code");
const deliveryCity = document.querySelector("#delivery-city");
const deliveryState = document.querySelector("#delivery-state");
const deliveryStreet = document.querySelector("#delivery-street");
const deliveryMessage = document.querySelector("#delivery-message");
const postalStatus = document.querySelector("#delivery-postal-status");
const editDeliveryButton = document.querySelector("#edit-delivery");

let postalLookupId = 0;

function digitsOnly(value) {
  return value.replace(/\D/g, "");
}

function formatPhone(value) {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : "";
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatPostalCode(value) {
  const digits = digitsOnly(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function clearDeliveryMessage() {
  deliveryMessage.textContent = "";
  deliveryMessage.hidden = true;
}

function validateField(field) {
  const value = field.value.trim();
  let message = "";

  if (field.required && !value) {
    message = "Este campo é obrigatório.";
  } else if (field.id === "delivery-name" && value && value.split(/\s+/).length < 2) {
    message = "Informe seu nome e sobrenome.";
  } else if (field === deliveryPhone && value && ![10, 11].includes(digitsOnly(value).length)) {
    message = "Informe o telefone com DDD e 10 ou 11 dígitos.";
  } else if (field === deliveryPostalCode && value && digitsOnly(value).length !== 8) {
    message = "Informe um CEP válido com 8 dígitos.";
  } else if (field.type === "email" && value && field.validity.typeMismatch) {
    message = "Informe um e-mail válido, como nome@exemplo.com.";
  }

  field.setCustomValidity(message);
  field.setAttribute("aria-invalid", String(Boolean(message)));
  return !message;
}

function validateDeliveryForm() {
  let valid = true;
  const fields = [...deliveryForm.querySelectorAll("input, select")];

  for (const field of fields) {
    if (!validateField(field)) {
      valid = false;
    }
  }

  if (!valid) {
    deliveryForm.reportValidity();
  }
  return valid;
}

async function fillAddressFromPostalCode() {
  const postalCode = digitsOnly(deliveryPostalCode.value);
  const lookupId = ++postalLookupId;
  if (postalCode.length !== 8) {
    postalStatus.textContent = "";
    return;
  }

  postalStatus.textContent = "Consultando CEP...";
  try {
    const response = await fetch(`https://viacep.com.br/ws/${postalCode}/json/`);
    if (!response.ok) {
      throw new Error("Consulta indisponível.");
    }

    const address = await response.json();
    if (lookupId !== postalLookupId) {
      return;
    }
    if (address.erro) {
      postalStatus.textContent = "CEP não encontrado. Confira ou preencha o endereço manualmente.";
      return;
    }

    deliveryCity.value = address.localidade || "";
    deliveryState.value = address.uf || "";
    deliveryStreet.value = address.logradouro || "";
    for (const field of [deliveryCity, deliveryState, deliveryStreet]) {
      validateField(field);
    }
    postalStatus.textContent = "Endereço localizado. Confira os dados e complete o número.";
    clearDeliveryMessage();
  } catch {
    if (lookupId === postalLookupId) {
      postalStatus.textContent = "Não foi possível consultar o CEP. Preencha o endereço manualmente.";
    }
  }
}

deliveryPhone.addEventListener("input", () => {
  deliveryPhone.value = formatPhone(deliveryPhone.value);
  validateField(deliveryPhone);
});

deliveryPostalCode.addEventListener("input", () => {
  deliveryPostalCode.value = formatPostalCode(deliveryPostalCode.value);
  validateField(deliveryPostalCode);
  if (digitsOnly(deliveryPostalCode.value).length === 8) {
    fillAddressFromPostalCode();
  }
});

deliveryPostalCode.addEventListener("blur", fillAddressFromPostalCode);

deliveryForm.addEventListener("input", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
    validateField(event.target);
    clearDeliveryMessage();
  }
});

deliveryForm.addEventListener("change", (event) => {
  if (event.target instanceof HTMLSelectElement) {
    validateField(event.target);
    clearDeliveryMessage();
  }
});

deliveryForm.addEventListener("reset", () => {
  postalLookupId += 1;
  postalStatus.textContent = "";
  clearDeliveryMessage();
  for (const field of deliveryForm.querySelectorAll("input, select")) {
    field.setCustomValidity("");
    field.removeAttribute("aria-invalid");
  }
});

deliveryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearDeliveryMessage();

  if (!validateDeliveryForm()) {
    return;
  }

  deliveryStep.hidden = true;
  checkoutStep.hidden = false;
  document.querySelector("#checkout").focus();
});

editDeliveryButton.addEventListener("click", () => {
  checkoutStep.hidden = true;
  deliveryStep.hidden = false;
  deliveryPhone.focus();
});
