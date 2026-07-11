import type { Employee } from "../types/employees";

export function getEmployeeName(employee: Employee) {
  if (employee.full_name) {
    return employee.full_name;
  }

  if (employee.name) {
    return employee.name;
  }

  const fullName = [employee.first_name, employee.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName) {
    return fullName;
  }

  if (employee.username) {
    return employee.username;
  }

  return `Personel #${employee.id}`;
}

export function getEmployeeDepartmentName(employee: Employee) {
  if (employee.department_name) {
    return employee.department_name;
  }

  if (typeof employee.department === "string") {
    return employee.department;
  }

  if (
    employee.department &&
    typeof employee.department === "object" &&
    "name" in employee.department
  ) {
    return employee.department.name ?? null;
  }

  return null;
}

export function getEmployeeJobTitleName(employee: Employee) {
  if (employee.job_title_name) {
    return employee.job_title_name;
  }

  if (typeof employee.job_title === "string") {
    return employee.job_title;
  }

  if (
    employee.job_title &&
    typeof employee.job_title === "object" &&
    "name" in employee.job_title
  ) {
    return employee.job_title.name ?? null;
  }

  return null;
}