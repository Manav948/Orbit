import { CategoryCard } from "./CategoryCard";
import { GlobeIcon, FinanceIcon, TechIcon, KnowledgeIcon } from "./icons";
import type { CategoryId } from "../types/desktop";

interface CategoryGridProps {
  selectedCategory: CategoryId | null;
  onSelectCategory: (id: CategoryId, title: string) => void;
}

export function CategoryGrid({
  selectedCategory,
  onSelectCategory,
}: CategoryGridProps) {
  const categories = [
    {
      id: "world-news" as CategoryId,
      title: "World News",
      subtitle: "Global headlines, geopolitical shifts & breaking updates",
      tag: "Live Updates",
      icon: <GlobeIcon className="w-full h-full" />,
      accentStyles: {
        bgGradient: "from-sky-500/10 via-transparent to-transparent",
        borderGlow: "shadow-sky-500/10",
        iconColor: "bg-sky-500/15 text-sky-400 border border-sky-400/20",
        tagStyle: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      },
    },
    {
      id: "finance-markets" as CategoryId,
      title: "Finance & Markets",
      subtitle: "Equities, macro indicators, currencies & commodities",
      tag: "Market Pulse",
      icon: <FinanceIcon className="w-full h-full" />,
      accentStyles: {
        bgGradient: "from-emerald-500/10 via-transparent to-transparent",
        borderGlow: "shadow-emerald-500/10",
        iconColor: "bg-emerald-500/15 text-emerald-400 border border-emerald-400/20",
        tagStyle: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      },
    },
    {
      id: "technology-ai" as CategoryId,
      title: "Technology & AI",
      subtitle: "Breakthroughs, models, hardware & ecosystem shifts",
      tag: "Deep Tech",
      icon: <TechIcon className="w-full h-full" />,
      accentStyles: {
        bgGradient: "from-indigo-500/10 via-transparent to-transparent",
        borderGlow: "shadow-indigo-500/10",
        iconColor: "bg-indigo-500/15 text-indigo-400 border border-indigo-400/20",
        tagStyle: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      },
    },
    {
      id: "daily-knowledge" as CategoryId,
      title: "Daily Knowledge",
      subtitle: "Curated insights, mental models & deep explainers",
      tag: "Explore",
      icon: <KnowledgeIcon className="w-full h-full" />,
      accentStyles: {
        bgGradient: "from-amber-500/10 via-transparent to-transparent",
        borderGlow: "shadow-amber-500/10",
        iconColor: "bg-amber-500/15 text-amber-400 border border-amber-400/20",
        tagStyle: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      },
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {categories.map((cat) => (
        <CategoryCard
          key={cat.id}
          id={cat.id}
          title={cat.title}
          subtitle={cat.subtitle}
          tag={cat.tag}
          icon={cat.icon}
          isSelected={selectedCategory === cat.id}
          accentStyles={cat.accentStyles}
          onClick={(id, title) => onSelectCategory(id as CategoryId, title)}
        />
      ))}
    </div>
  );
}

