export type EndorsementTemplate = {
  id: string;
  title: string;
  reference: string;
  summary: string;
  template: string;
};

export const endorsementTemplates: EndorsementTemplate[] = [
  {
    id: "pre-solo-61-87",
    title: "Pre-solo knowledge & flight training (61.87)",
    reference: "14 CFR 61.87",
    summary: "Confirms required pre-solo training has been provided.",
    template:
      "I certify that [STUDENT NAME] has received the training required by 14 CFR 61.87 and is prepared for the presolo knowledge test and flight training in a [MAKE/MODEL].",
  },
  {
    id: "solo-61-87",
    title: "Solo flight endorsement (61.87)",
    reference: "14 CFR 61.87",
    summary: "Authorizes solo flight for a specific make/model.",
    template:
      "I certify that [STUDENT NAME] has received the training required by 14 CFR 61.87 and is proficient to solo in a [MAKE/MODEL].",
  },
  {
    id: "solo-xc-61-93",
    title: "Solo cross-country (61.93)",
    reference: "14 CFR 61.93",
    summary: "Authorizes solo cross-country for a specific route.",
    template:
      "I certify that [STUDENT NAME] has received the training required by 14 CFR 61.93 and is authorized to conduct the following solo cross-country flight: [ROUTE].",
  },
  {
    id: "night-61-109",
    title: "Night flying privileges (61.109)",
    reference: "14 CFR 61.109",
    summary: "Confirms required night training completion.",
    template:
      "I certify that [STUDENT NAME] has completed the night training requirements of 14 CFR 61.109 and is proficient in night flight operations.",
  },
  {
    id: "high-performance-61-31f",
    title: "High-performance endorsement (61.31(f))",
    reference: "14 CFR 61.31(f)",
    summary: "Required for aircraft with >200 HP.",
    template:
      "I certify that [PILOT NAME] has received the training required by 14 CFR 61.31(f) in a high-performance airplane and is proficient to act as PIC.",
  },
];
