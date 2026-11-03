export function mascararTelefone(tel?: string | null) {
  if (!tel) return "";
  const d = tel.replace(/\D/g, "");
  if (d.length < 4) return "••••";
  return `(••) •••••-${d.slice(-4)}`;
}

export function mascararEmail(email?: string | null) {
  if (!email) return "";
  const [u, dom] = email.split("@");
  if (!dom) return "••••";
  return `${u.slice(0, 1)}•••@${dom}`;
}
