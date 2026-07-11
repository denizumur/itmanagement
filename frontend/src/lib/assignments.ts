import type { Assignment, AssignmentEmployee } from "../types/assignments";

function getNestedDepartmentName(employee: AssignmentEmployee) {
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

function getNestedJobTitleName(employee: AssignmentEmployee) {
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

export function getAssignmentAssetId(assignment: Assignment) {
  if (typeof assignment.asset_id === "number") {
    return assignment.asset_id;
  }

  if (typeof assignment.asset === "number") {
    return assignment.asset;
  }

  if (
    assignment.asset &&
    typeof assignment.asset === "object" &&
    typeof assignment.asset.id === "number"
  ) {
    return assignment.asset.id;
  }

  if (
    assignment.asset_detail &&
    typeof assignment.asset_detail.id === "number"
  ) {
    return assignment.asset_detail.id;
  }

  return null;
}

export function getAssignmentAssetName(assignment: Assignment) {
  if (assignment.asset_name) {
    return assignment.asset_name;
  }

  if (assignment.asset && typeof assignment.asset === "object") {
    return assignment.asset.name || "Varlık";
  }

  if (assignment.asset_detail?.name) {
    return assignment.asset_detail.name;
  }

  return "Varlık";
}

export function getAssignmentAssetCode(assignment: Assignment) {
  if (assignment.asset_inventory_code) {
    return assignment.asset_inventory_code;
  }

  if (assignment.asset && typeof assignment.asset === "object") {
    return assignment.asset.inventory_code || assignment.asset.serial_number || null;
  }

  if (assignment.asset_detail) {
    return (
      assignment.asset_detail.inventory_code ||
      assignment.asset_detail.serial_number ||
      null
    );
  }

  return null;
}

export function getAssignmentEmployeeName(assignment: Assignment) {
  if (assignment.employee_name) {
    return assignment.employee_name;
  }

  if (assignment.employee_full_name) {
    return assignment.employee_full_name;
  }

  if (assignment.assigned_employee_name) {
    return assignment.assigned_employee_name;
  }

  if (assignment.assigned_to_name) {
    return assignment.assigned_to_name;
  }

  if (typeof assignment.employee === "string") {
    return assignment.employee;
  }

  if (assignment.employee && typeof assignment.employee === "object") {
    const employee = assignment.employee;

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
  }

  return "Zimmetli";
}

export function getAssignmentDepartmentName(assignment: Assignment) {
  if (assignment.employee && typeof assignment.employee === "object") {
    return (
      assignment.employee.department_name ||
      getNestedDepartmentName(assignment.employee)
    );
  }

  return null;
}

export function getAssignmentJobTitleName(assignment: Assignment) {
  if (assignment.employee && typeof assignment.employee === "object") {
    return (
      assignment.employee.job_title_name ||
      getNestedJobTitleName(assignment.employee)
    );
  }

  return null;
}

export function buildActiveAssignmentMap(assignments: Assignment[]) {
  const map = new Map<number, Assignment>();

  for (const assignment of assignments) {
    const assetId = getAssignmentAssetId(assignment);

    if (assetId) {
      map.set(assetId, assignment);
    }
  }

  return map;
}