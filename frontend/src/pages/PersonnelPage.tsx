import { IconRefresh, IconSearch, IconUsers } from "@tabler/icons-react";
import { AppShell } from "../components/layout/AppShell";
import { DataTable, type DataTableColumn } from "../components/common/DataTable";
import { TablePagination } from "../components/common/TablePagination";
import { useEmployeeTable } from "../hooks/useEmployeeTable";
import { useTableQueryState } from "../hooks/useTableQueryState";
import type { Employee } from "../types/employees";
import { MiniMetricCard } from "../components/common/MiniMetricCard";

function getEmployeeDisplayName(employee: Employee) {
  return employee.full_name || employee.name || "";
}

function getFirstName(employee: Employee) {
  if (employee.first_name) {
    return employee.first_name;
  }

  const displayName = getEmployeeDisplayName(employee).trim();

  if (!displayName) {
    return "-";
  }

  const parts = displayName.split(/\s+/);

  return parts[0] || "-";
}

function getLastName(employee: Employee) {
  if (employee.last_name) {
    return employee.last_name;
  }

  const displayName = getEmployeeDisplayName(employee).trim();

  if (!displayName) {
    return "-";
  }

  const parts = displayName.split(/\s+/);

  if (parts.length <= 1) {
    return "-";
  }

  return parts.slice(1).join(" ");
}

const columns: DataTableColumn<Employee>[] = [
  {
    key: "first_name",
    label: "Adı",
    sortable: true,
    sortKey: "full_name",
    render: (employee) => getFirstName(employee),
  },
  {
    key: "last_name",
    label: "Soyadı",
    sortable: true,
    sortKey: "full_name",
    render: (employee) => getLastName(employee),
  },
  {
    key: "email",
    label: "E-Posta adresi",
    sortable: true,
    sortKey: "email",
    render: (employee) => employee.user_email || employee.email || "-",
  },
  {
    key: "department_name",
    label: "Departman",
    sortable: true,
    sortKey: "department__name",
    render: (employee) => employee.department_name || "-",
  },
  {
    key: "job_title_name",
    label: "Meslek",
    sortable: true,
    sortKey: "job_title__name",
    render: (employee) => employee.job_title_name || "-",
  },
  {
    key: "is_active",
    label: "Durum",
    render: (employee) => (
      <span
        className={
          employee.is_active
            ? "rounded-full border border-success/30 bg-success/10 px-sm py-1 text-caption text-success"
            : "rounded-full border border-danger/30 bg-danger/10 px-sm py-1 text-caption text-danger"
        }
      >
        {employee.is_active ? "Aktif" : "Pasif"}
      </span>
    ),
  },
];

export function PersonnelPage() {
  const {
    state,
    setSearch,
    setSort,
    setPage,
    setPageSize,
    setFilter,
    resetFilters,
  } = useTableQueryState({
    page: 1,
    pageSize: 25,
    ordering: "full_name",
  });

  const employeesQuery = useEmployeeTable(state);
  const data = employeesQuery.data;
  const totalUserCount = data?.count ?? 0;

  const selectedRole =
    typeof state.filters.user_role === "string" ? state.filters.user_role : "";

  const selectedStatus =
    typeof state.filters.is_active === "string" ? state.filters.is_active : "";

  return (
    <AppShell>
      <section className="flex flex-col gap-lg">
        <header className="flex flex-col gap-md rounded-panel border border-border bg-surface-1 p-lg shadow-panel md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-h1">Personel</h1>
            <p className="mt-sm max-w-3xl text-body text-text-secondary">
              Şirket personel kayıtlarını görüntüle, ara, filtrele ve sırala.
            </p>
          </div>

          <button
            type="button"
            onClick={() => employeesQuery.refetch()}
            className="inline-flex items-center justify-center gap-xs rounded-app border border-border px-md py-sm text-body text-text-primary transition hover:border-accent hover:text-accent"
          >
            <IconRefresh size={18} aria-hidden={true} />
            Yenile
          </button>
        </header>

        <section className="flex flex-wrap gap-sm">
            <MiniMetricCard
                label="Kullanıcı sayısı"
                value={totalUserCount}
                icon={<IconUsers size={15} aria-hidden={true} />}
            />
        </section>

        <section className="grid gap-md rounded-panel border border-border bg-surface-1 p-md shadow-panel md:grid-cols-[1.5fr_220px_220px_auto] md:items-end">
          <label className="flex flex-col gap-xs">
            <span className="text-caption text-text-secondary">Arama</span>
            <div className="flex items-center gap-xs rounded-app border border-border bg-surface-2 px-sm">
              <IconSearch size={18} className="text-text-secondary" />
              <input
                value={state.search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ad, e-posta, kullanıcı, departman..."
                className="w-full bg-transparent py-sm text-body text-text-primary outline-none placeholder:text-text-muted"
              />
            </div>
          </label>

          <label className="flex flex-col gap-xs">
            <span className="text-caption text-text-secondary">Rol</span>
            <select
              value={selectedRole}
              onChange={(event) =>
                setFilter("user_role", event.target.value || null)
              }
              className="rounded-app border border-border bg-surface-2 px-sm py-sm text-body text-text-primary outline-none focus:border-accent"
            >
              <option value="">Tüm roller</option>
              <option value="admin">Admin</option>
              <option value="technician">Technician</option>
              <option value="viewer">Viewer</option>
              <option value="approver">Approver</option>
              <option value="requester">Requester</option>
            </select>
          </label>

          <label className="flex flex-col gap-xs">
            <span className="text-caption text-text-secondary">Durum</span>
            <select
              value={selectedStatus}
              onChange={(event) =>
                setFilter("is_active", event.target.value || null)
              }
              className="rounded-app border border-border bg-surface-2 px-sm py-sm text-body text-text-primary outline-none focus:border-accent"
            >
              <option value="">Varsayılan aktifler</option>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </select>
          </label>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-xs rounded-app border border-border px-md py-sm text-body text-text-primary transition hover:border-accent hover:text-accent"
          >
            Temizle
          </button>
        </section>

        {employeesQuery.isError ? (
          <div className="rounded-panel border border-danger/30 bg-danger/10 p-md text-body text-danger">
            Personel tablosu yüklenemedi.
          </div>
        ) : null}

        <DataTable
          columns={columns}
          data={data?.results ?? []}
          getRowKey={(employee) => employee.id}
          ordering={state.ordering}
          onSortChange={setSort}
          isLoading={employeesQuery.isLoading}
          emptyMessage="Personel kaydı bulunamadı."
        />

        <TablePagination
          page={state.page}
          pageSize={state.pageSize}
          totalCount={data?.count ?? 0}
          hasNext={Boolean(data?.next)}
          hasPrevious={Boolean(data?.previous)}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </section>
    </AppShell>
  );
}