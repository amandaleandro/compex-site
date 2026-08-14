const legacyCourseNames: Record<string, string> = {
  "computacao": "Ciência da Computação",
  "ciencia da computacao": "Ciência da Computação",
  "sistemas": "Sistemas de Informação",
  "sistemas de informacao": "Sistemas de Informação",
  "fisica medica": "Física Médica",
  "fisica de materiais": "Física de Materiais",
  "quimica": "Química",
  "quimica industrial": "Química Industrial",
  "estatistica": "Estatística",
};

function comparable(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function courseName(value: string | null | undefined) {
  if (!value?.trim()) return "Curso não informado";
  return legacyCourseNames[comparable(value)] || value.trim();
}
