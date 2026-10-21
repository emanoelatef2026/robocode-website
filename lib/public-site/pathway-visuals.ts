import type { LocalizedText } from "./online-programs";

// Downloaded, unmodified marks. Source/attribution record: docs/design/pathway-assets.md.
export const PATHWAY_TOOLS = {
  codeorg: { name: "Code.org", image: "codeorg.svg", source: "https://code.org/", dark: true },
  scratchjr: { name: "ScratchJr", image: "scratchjr.png", source: "https://www.scratchjr.org/", dark: false },
  scratch: { name: "Scratch", image: "scratch.svg", source: "https://scratch.mit.edu/", dark: false },
  mblock: { name: "mBlock", image: "mblock.svg", source: "https://www.mblock.cc/", dark: false },
  kodu: { name: "Kodu", image: "kodu.png", source: "https://www.kodugamelab.com/", dark: false },
  pictoblox: { name: "PictoBlox", image: "pictoblox.svg", source: "https://pictoblox.ai/", dark: false },
  appInventor: { name: "MIT App Inventor", image: "app-inventor.svg", source: "https://appinventor.mit.edu/", dark: false },
  python: { name: "Python", image: "python.svg", source: "https://www.python.org/community/logos/", dark: false },
  colab: { name: "Google Colab", image: "colab.png", source: "https://colab.research.google.com/", dark: false },
  vscode: { name: "VS Code", image: "vscode.png", source: "https://code.visualstudio.com/", dark: false },
  flutter: { name: "Flutter", image: "flutter.svg", source: "https://flutter.dev/brand", dark: false },
  dart: { name: "Dart", image: "dart.svg", source: "https://dart.dev/brand", dark: false },
} as const;

export type PathwayToolId = keyof typeof PATHWAY_TOOLS;
type PathwayVisual = {
  title: LocalizedText;
  summary: LocalizedText;
  image: string;
  alt: LocalizedText;
  coverTools: readonly PathwayToolId[];
  semesterTools: readonly (readonly PathwayToolId[])[];
};

export const PATHWAY_VISUALS: Record<string, PathwayVisual> = {
  "ages-6-8": {
    title: { ar: "أول خطوة في البرمجة", en: "First Steps in Coding" },
    summary: { ar: "يصنع قصصه وألعابه الأولى بنفسه.", en: "Create their first stories and games." },
    image: "/images/pathways/content-6-8-v1.webp",
    coverTools: ["scratchjr", "kodu"],
    alt: { ar: "تصميم توضيحي مولّد لعالم ألعاب وقصص مع بلوكات برمجة", en: "AI-generated illustration of a storybook game world and visual coding blocks" },
    semesterTools: [["codeorg"], ["scratchjr"], ["scratchjr", "scratch"], ["kodu"]],
  },
  "ages-9-11": {
    title: { ar: "ألعاب وتطبيقات", en: "Games & Apps" },
    summary: { ar: "من تصميم الألعاب لأول تطبيق موبايل.", en: "From making games to their first mobile app." },
    image: "/images/pathways/content-9-11-v1.webp",
    coverTools: ["pictoblox", "appInventor"],
    alt: { ar: "تصميم توضيحي مولّد يجمع الألعاب وتطبيقات الموبايل والبرمجة البصرية", en: "AI-generated illustration of game creation, mobile apps and visual coding blocks" },
    semesterTools: [["codeorg"], ["scratch", "mblock"], ["pictoblox"], ["appInventor"]],
  },
  "ages-12-14": {
    title: { ar: "Python والذكاء الاصطناعي", en: "Python & AI" },
    summary: { ar: "يحوّل أفكاره لمشروعات ذكية بـPython.", en: "Turn ideas into intelligent Python projects." },
    image: "/images/pathways/content-12-14-v1.webp",
    coverTools: ["python"],
    alt: { ar: "تصميم توضيحي مولّد لشبكة ذكاء اصطناعي وبيانات ورموز برمجة", en: "AI-generated illustration of an AI network, data and coding symbols" },
    semesterTools: [["python"], ["python"], ["python"], ["python"]],
  },
  "ages-15-17": {
    title: { ar: "برمجة ومواقع وتطبيقات", en: "Code, Web & Mobile" },
    summary: { ar: "يبني مواقع تفاعلية وتطبيقات موبايل.", en: "Build interactive websites and mobile apps." },
    image: "/images/pathways/content-15-17-v1.webp",
    coverTools: ["vscode", "flutter"],
    alt: { ar: "تصميم توضيحي مولّد لتطوير المواقع وتطبيقات الموبايل", en: "AI-generated illustration of website and mobile app development" },
    semesterTools: [["python", "colab"], ["vscode"], ["vscode"], ["flutter", "dart", "vscode"]],
  },
};
