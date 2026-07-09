import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { EmptyState } from "../common/EmptyState";

ChartJS.register(ArcElement, Tooltip, Legend);

interface CategoryDoughnutChartProps {
  labels: string[];
  counts: number[];
}

function cssVar(name: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

export function CategoryDoughnutChart({
  labels,
  counts,
}: CategoryDoughnutChartProps) {
  if (!labels.length || !counts.length) {
    return <EmptyState message="Kategori dağılımı için kayıt yok." />;
  }

  const palette = [
    cssVar("--color-accent"),
    cssVar("--color-warning"),
    cssVar("--color-success"),
    cssVar("--color-danger"),
    cssVar("--text-secondary"),
    cssVar("--surface-0"),
  ];

  return (
    <div className="panel">
      <p className="mb-md text-h3">Kategoriye göre varlık dağılımı</p>

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
          options={{
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
          }}
        />
      </div>
    </div>
  );
}