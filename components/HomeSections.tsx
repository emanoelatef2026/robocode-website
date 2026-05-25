"use client";

import Hero                    from "./Hero";
import TrustSection            from "./TrustSection";
import WhySection              from "./WhySection";
import ProgramsSection         from "./ProgramsSection";
import LearningJourneySection  from "./LearningJourneySection";
import ProjectsSection         from "./ProjectsSection";
import FeaturedStudentsSection from "./FeaturedStudentsSection";
import CompetitionsSection     from "./CompetitionsSection";
import BranchesSection         from "./BranchesSection";
import ContactSection          from "./ContactSection";
import AccreditationsSection   from "./AccreditationsSection";
import PartnersSection         from "./PartnersSection";
import ReviewsSection          from "./ReviewsSection";
import FAQSection              from "./FAQSection";
import Reveal                  from "./Reveal";

// Each value is a factory so React creates fresh elements on each render.
// Sections that already carry their own scroll-reveal animations are left
// bare; others are wrapped in <Reveal> for a consistent entrance effect.
const SECTION_MAP: Record<string, () => React.ReactNode> = {
  hero:              () => <Hero />,
  trust:             () => <TrustSection />,
  why:               () => <WhySection />,
  programs:          () => <ProgramsSection />,
  learning_journey:  () => <Reveal><LearningJourneySection /></Reveal>,
  projects:          () => <Reveal><ProjectsSection /></Reveal>,
  featured_students: () => <Reveal><FeaturedStudentsSection /></Reveal>,
  competitions:      () => <CompetitionsSection />,
  branches:          () => <Reveal><BranchesSection /></Reveal>,
  contact:           () => <Reveal><ContactSection /></Reveal>,
  accreditations:    () => <Reveal><AccreditationsSection /></Reveal>,
  partners:          () => <Reveal><PartnersSection /></Reveal>,
  reviews:           () => <Reveal><ReviewsSection /></Reveal>,
  faq:               () => <Reveal><FAQSection /></Reveal>,
};

interface Props {
  sections: string[];
}

export default function HomeSections({ sections }: Props) {
  return (
    <>
      {sections.map((key) => {
        const render = SECTION_MAP[key];
        if (!render) return null;
        return <div key={key}>{render()}</div>;
      })}
    </>
  );
}
