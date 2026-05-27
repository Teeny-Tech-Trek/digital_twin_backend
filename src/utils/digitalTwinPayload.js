const cleanText = (value) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const asArray = (value) => (Array.isArray(value) ? value : []);

const cleanStringArray = (value) => {
  const seen = new Set();
  const out = [];
  for (const item of asArray(value)) {
    const text = cleanText(String(item || ""));
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
};

const normalizeYear = (value) => {
  const text = cleanText(String(value || ""));
  if (!text) return "";
  const years = text.match(/(?:19|20)\d{2}/g) || [];
  if (years.length >= 2) return `${years[0]} - ${years[years.length - 1]}`;
  if (years.length === 1) return years[0];
  return /present|current|ongoing|expected/i.test(text) ? text : text.slice(0, 40);
};

const educationKey = (item) =>
  [item.institution, item.degree, item.year].map((v) => cleanText(v).toLowerCase()).join("|");

const experienceKey = (item) =>
  [item.company, item.role, item.duration].map((v) => cleanText(v).toLowerCase()).join("|");

const businessKey = (item) =>
  [item.name, item.role].map((v) => cleanText(v).toLowerCase()).join("|");

const EDUCATION_RE =
  /\b(university|college|school|institute|academy|campus|bachelor|master|degree|diploma|postgraduate|undergraduate|gpa|cgpa)\b/i;
const COMMUNITY_RE =
  /\b(student|club|chapter|society|community|volunteer|nonprofit|non-profit|ambassador|campus|committee|council|association|hackathon)\b/i;
const CERTIFICATION_RE =
  /\b(certification|certificate|credential|course|bootcamp|workshop|training|license|membership|hackathon|award|honou?r|competition)\b/i;

const itemText = (item) =>
  Object.values(item || {})
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value) => ["string", "number"].includes(typeof value))
    .join(" ");

const belongsOutsideStrictCompanyArrays = (item) => {
  const text = itemText(item);
  return EDUCATION_RE.test(text) || COMMUNITY_RE.test(text) || CERTIFICATION_RE.test(text);
};

const dedupeObjects = (items, keyFn) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key.replace(/\|/g, "") || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

const sanitizeEducation = (education = []) => {
  const valid = [];
  for (const item of asArray(education)) {
    if (!item || typeof item !== "object") continue;
    const normalized = {
      institution: cleanText(item.institution || item.school || item.college || item.university),
      degree: cleanText(item.degree || item.program || item.qualification || item.course),
      year: normalizeYear(item.year || item.duration || item.dates),
    };
    if (normalized.institution && normalized.degree && normalized.year) {
      valid.push(normalized);
    }
  }
  return dedupeObjects(valid, educationKey);
};

const sanitizeExperience = (experience = []) => {
  const valid = [];
  for (const item of asArray(experience)) {
    if (!item || typeof item !== "object") continue;
    const normalized = {
      company: cleanText(item.company || item.name),
      role: cleanText(item.role || item.position || item.title),
      duration: cleanText(item.duration || item.dates || item.year),
      key_projects: cleanStringArray(item.key_projects || item.projects || item.responsibilities),
    };
    if (
      normalized.company &&
      normalized.role &&
      normalized.duration &&
      !belongsOutsideStrictCompanyArrays(normalized)
    ) {
      valid.push(normalized);
    }
  }
  return dedupeObjects(valid, experienceKey);
};

const sanitizeBusinesses = (businesses = []) => {
  const valid = [];
  for (const item of asArray(businesses)) {
    if (!item || typeof item !== "object") continue;
    const normalized = {
      name: cleanText(item.name || item.company || item.title),
      role: cleanText(item.role || item.position),
      description: cleanText(item.description || item.company_details || item.summary),
      link: cleanText(item.link || item.url),
      products: cleanStringArray(item.products),
      duration: cleanText(item.duration || item.dates || item.year),
    };
    if (
      normalized.name &&
      normalized.role &&
      normalized.description &&
      !belongsOutsideStrictCompanyArrays(normalized)
    ) {
      valid.push(normalized);
    }
  }
  return dedupeObjects(valid, businessKey);
};

export const sanitizeDigitalTwinPayload = (payload = {}) => ({
  ...payload,
  businesses: sanitizeBusinesses(payload.businesses),
  experience: sanitizeExperience(payload.experience),
  education: sanitizeEducation(payload.education),
  skills: {
    ...(payload.skills || {}),
    list: cleanStringArray(payload.skills?.list),
  },
  personality: {
    ...(payload.personality || {}),
    traits: cleanStringArray(payload.personality?.traits),
    values: cleanStringArray(payload.personality?.values),
  },
  story: {
    ...(payload.story || {}),
    themes: cleanStringArray(payload.story?.themes),
  },
  networking: {
    ...(payload.networking || {}),
    boundaries: cleanStringArray(payload.networking?.boundaries),
  },
  links: {
    ...(payload.links || {}),
    socials: cleanStringArray(payload.links?.socials),
  },
});
