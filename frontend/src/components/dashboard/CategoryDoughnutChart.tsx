import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
import type { ChartOptions } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { EmptyState } from "../common/EmptyState";
import { DataCard } from "../ui/DataCard";

ChartJS.register(ArcElement, Tooltip, Legend);

interface CategoryDoughnutChartProps {
  labels: string[];
  counts: number[];
}

function cssVar(name: string) {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function CategoryDoughnutChart({
  labels,
  counts,
}: CategoryDoughnutChartProps) {
  if (!labels.length || !counts.length) {
    return (
      <DataCard title="Kategori dağılımı">
        <EmptyState message="Kategori dağılımı için kayıt yok." />
      </DataCard>
    );
  }

  const palette = [
    cssVar("--color-accent"),
    cssVar("--color-warning"),
    cssVar("--color-success"),
    cssVar("--color-danger"),
    cssVar("--text-secondary"),
    cssVar("--surface-0"),
  ];

  const options: ChartOptions<"doughnut"> = {
    cutout: "65%",
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: cssVar("--text-secondary"),
          boxWidth: 10,
          boxHeight: 10,
        },
      },
    },
  };

  return (
    <DataCard
      title="Kategoriye göre varlık dağılımı"
      description="Backend tarafından agregasyonlu gelen kategori kırılımı."
      className="p-lg"
    >
      <div className="mx-auto max-h-[320px] max-w-[420px]">
        <Doughnut
          data={{
            labels,
            datasets: [
              {
                data: counts,
                backgroundColor: labels.map(
                  (_, index) => palette[index % palette.length]
                ),
                borderWidth: 0,
              },
            ],
          }}
          options={options}
        />
      </div>
    </DataCard>
  );
}