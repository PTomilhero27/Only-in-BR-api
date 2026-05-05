import { PixKeyType } from '@prisma/client';

export function isCPFValid(cpf: string): boolean {
  if (typeof cpf !== 'string') return false;
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
  
  const cpfArray = cpf.split('').map(el => +el);
  const rest = (count: number) => (cpfArray.slice(0, count - 12).reduce((soma, el, index) => soma + el * (count - index), 0) * 10) % 11 % 10;
  return rest(10) === cpfArray[9] && rest(11) === cpfArray[10];
}

export function isCNPJValid(cnpj: string): boolean {
  if (!cnpj) return false;
  cnpj = cnpj.replace(/[^\d]+/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  const digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado !== parseInt(digitos.charAt(0))) return false;
  
  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado !== parseInt(digitos.charAt(1))) return false;
  
  return true;
}

export interface DetectPixKeyResult {
  type: PixKeyType | null;
  normalizedKey: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason?: string;
}

/**
 * Identifica automaticamente o tipo da chave PIX baseado no input e no documento do titular.
 * Por que o sistema detecta automaticamente?
 * R: A planilha pode não vir com a informação exata (telefone, cpf, etc) bem descrita ou normalizada.
 * Isso ajuda a evitar erros na hora de gerar a remessa PIX onde o tipo exato é mandatório.
 */
export function detectPixKeyType(input: string, holderDocument?: string): DetectPixKeyResult {
  if (!input || !input.trim()) {
    return {
      type: null,
      normalizedKey: '',
      confidence: "LOW",
      reason: "Chave PIX não informada."
    };
  }

  let key = input.trim();
  const normalizedDoc = holderDocument ? holderDocument.replace(/[^\d]+/g, '') : null;

  // 2. E-mail
  if (key.includes('@')) {
    // validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(key)) {
      return {
        type: PixKeyType.EMAIL,
        normalizedKey: key.toLowerCase(),
        confidence: "HIGH"
      };
    }
  }

  // 8. UUID (Random)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(key)) {
    return {
      type: PixKeyType.RANDOM,
      normalizedKey: key.toLowerCase(),
      confidence: "HIGH"
    };
  }

  // 6. Telefone Internacional (começa com +)
  if (key.startsWith('+')) {
    const cleanPhone = key.replace(/[^\d+]/g, '');
    if (cleanPhone.length >= 12 && cleanPhone.length <= 15) {
      return {
        type: PixKeyType.PHONE,
        normalizedKey: cleanPhone,
        confidence: "HIGH"
      };
    }
  }

  // 3. Remover pontuação para análise numérica
  const cleanKey = key.replace(/[^\d]+/g, '');

  if (cleanKey.length === 11) {
    // 4. Se a chave tem 11 dígitos
    if (normalizedDoc && cleanKey === normalizedDoc) {
      return { type: PixKeyType.CPF, normalizedKey: cleanKey, confidence: "HIGH" };
    }

    const isCpf = isCPFValid(cleanKey);
    if (isCpf) {
      return { type: PixKeyType.CPF, normalizedKey: cleanKey, confidence: "HIGH" };
    } else {
      // 7. Se não for CPF válido, considerar PHONE brasileiro
      // Normalizar para +55DDDNUMERO
      return {
        type: PixKeyType.PHONE,
        normalizedKey: `+55${cleanKey}`,
        confidence: "MEDIUM",
        reason: "Não passou na validação de CPF, assumido como telefone."
      };
    }
  } else if (cleanKey.length === 14) {
    // 5. Se a chave tem 14 dígitos
    if (normalizedDoc && cleanKey === normalizedDoc) {
      return { type: PixKeyType.CNPJ, normalizedKey: cleanKey, confidence: "HIGH" };
    }
    
    if (isCNPJValid(cleanKey)) {
      return { type: PixKeyType.CNPJ, normalizedKey: cleanKey, confidence: "HIGH" };
    } else {
      return {
        type: null,
        normalizedKey: key,
        confidence: "LOW",
        reason: "Chave tem 14 dígitos mas não é um CNPJ válido."
      };
    }
  } else if (cleanKey.length === 10) {
    // Telefone fixo brasileiro com DDD
    return {
      type: PixKeyType.PHONE,
      normalizedKey: `+55${cleanKey}`,
      confidence: "MEDIUM"
    };
  }

  // 9. Caso contrário
  return {
    type: null,
    normalizedKey: key,
    confidence: "LOW",
    reason: "Não foi possível identificar o tipo da chave PIX."
  };
}
