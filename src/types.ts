export interface UserProfile {
  uid: string;
  name: string;
  surname?: string;
  idCardNumber?: string;
  idCardPhoto?: string;
  role: 'Admin' | 'BranchManager' | 'Inspection' | 'Authority' | 'Maintenance' | 'Contractor' | 'Citizen' | 'Coordinator' | 'Supervisor' | 'wali';
  entity?: 'Municipality' | 'Sonelgaz' | 'ADE' | 'ONA' | 'ProjectsCoordination' | 'Wilaya';
  phoneNumber?: string;
  email?: string;
  region?: string;
  wilaya?: string;
  province?: string;
  district?: string;
  districts?: string[];
  municipality?: string;
  municipalities?: string[];
  administrativeLevel?: 'wilaya' | 'district' | 'municipality';
  authorityLevel?: 'Province' | 'District' | 'Municipality';
  contractorUid?: string;
  status: 'Active' | 'Frozen';
  createdAt: string;
}

export interface Report {
  id: string;
  serialNumber?: string;
  citizenUid: string;
  targetEntity: 'Municipality' | 'Sonelgaz' | 'ADE' | 'ONA';
  type: string;
  photoUrl: string;
  landmarkPhotoUrl?: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  note: string;
  status: 'New' | 'Inspected' | 'Pricing' | 'Negotiating' | 'Permitted' | 'Repairing' | 'Repaired' | 'Verified' | 'Rejected' | 'Archived';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  urgency: 'Low' | 'Medium' | 'High' | 'Immediate';
  subType?: string;
  extraDetails?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  municipality?: string;
  district?: string;
  province?: string;
  municipalityId?: string;
  districtId?: string;
  provinceId?: string;
  estimatedCost?: number;
  finalPrice?: number;
  contractorUid?: string;
  branchManagerUid?: string;
  escalatedTo?: 'District' | 'Province';
  escalationTime?: string;
  inspectionDetails?: {
    photos: string[];
    videos: string[];
    price: number;
    proposal: string;
    note: string;
    documents: string[];
  };
  repairDetails?: {
    photos: string[];
    videos: string[];
    note: string;
    documents: string[];
  };
  verificationDetails?: {
    photos: string[];
    videos: string[];
    note: string;
    documents: string[];
    status: 'Accepted' | 'Rejected';
  };
  permitIssuedAt?: string;
  permitDocumentUrl?: string;
}

export type ProjectStatus = 
  | 'draft' 
  | 'under_review' 
  | 'waiting_for_directorates' 
  | 'has_preliminary_works' 
  | 'conflict_detected' 
  | 'coordination_meeting_required' 
  | 'reserved_area' 
  | 'waiting_for_budget' 
  | 'ready_to_start' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled';

export interface Project {
  id: string;
  title: string;
  description: string;
  projectType: 'Immediate' | 'Future';
  ownerDirectorateId: string;
  ownerDirectorateName: string;
  locationName: string;
  latitude: number;
  longitude: number;
  geometry?: any;
  municipality: string;
  district: string;
  wilaya: string;
  expectedStartDate: string;
  expectedDuration: string;
  budgetStatus: 'Available' | 'Pending' | 'Unknown';
  projectStage: string;
  status: ProjectStatus;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  hasConflict: boolean;
  createdBy: string;
  coordinatorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoordinationRequest {
  id: string;
  projectId: string;
  coordinatorId: string;
  sentToDirectorateIds: string[];
  message: string;
  responseDeadline: string;
  status: 'Pending' | 'Completed';
  createdAt: string;
}

export interface DirectorateResponse {
  id: string;
  requestId: string;
  projectId: string;
  directorateId: string;
  directorateName: string;
  responseType: 'NoConflict' | 'PreliminaryWorks' | 'InspectionRequired' | 'MeetingRequired' | 'Conflict';
  comment: string;
  proposedWorkDate?: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface Conflict {
  id: string;
  projectId: string;
  conflictingProjectId: string;
  conflictType: 'Spatial' | 'Temporal' | 'TemporalSpatial';
  description: string;
  detectedBy: string;
  status: 'Detected' | 'Resolved';
  createdAt: string;
  resolvedAt?: string;
}

export interface NoConflictCertificate {
  id: string;
  projectId: string;
  certificateNumber: string;
  issuedByCoordinatorId: string;
  result: 'NoConflict' | 'Conflict' | 'RequiresDecision';
  summary: string;
  notifiedDirectorates: string[];
  responsesSummary: Record<string, string>;
  issuedAt: string;
}

export interface ProjectLog {
  id: string;
  projectId: string;
  userId: string;
  action: string;
  oldStatus?: ProjectStatus;
  newStatus?: ProjectStatus;
  note: string;
  createdAt: string;
}

export interface Negotiation {
  id: string;
  reportId: string;
  contractorUid: string;
  authorityUid: string;
  offeredPrice: number;
  counterPrice?: number;
  status: 'Pending' | 'Accepted' | 'Rejected';
  createdAt: string;
}

export interface Evidence {
  id: string;
  reportId: string;
  type: 'Inspection' | 'Repair' | 'Verification';
  mediaUrls: string[];
  note: string;
  workerUid: string;
  createdAt: string;
}

export interface AdministrativeDecision {
  id: string;
  projectId: string;
  conflictId?: string;
  issuedByUserId: string;
  issuedByName: string;
  issuedByRole: 'wali' | 'Admin';
  decisionType: 
    | 'approve_project' 
    | 'reject_project' 
    | 'modify_project_location' 
    | 'request_meeting' 
    | 'freeze_project' 
    | 'confirm_reserved_area' 
    | 'cancel_reserved_area' 
    | 'request_additional_study' 
    | 'resolve_conflict';
  decisionText: string;
  affectedDirectorates: string[];
  status: 'Draft' | 'Final';
  createdAt: string;
}
