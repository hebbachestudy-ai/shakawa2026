import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp, 
  orderBy,
  onSnapshot 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Project, ProjectStatus, Conflict, ProjectLog, AdministrativeDecision } from '../types';

export const coordinationService = {
  // Projects
  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'hasConflict'>) {
    const projectsRef = collection(db, 'projects');
    
    // Check for conflicts before creating (simplified logic)
    const hasConflict = await this.checkForConflicts(projectData.latitude, projectData.longitude);
    
    const newProject = {
      ...projectData,
      status: hasConflict ? 'conflict_detected' : projectData.status,
      hasConflict,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    try {
      const docRef = await addDoc(projectsRef, newProject);
      
      // If conflict detected, create conflict records
      if (hasConflict) {
        const conflictingProjects = await this.findConflictingProjects(projectData.latitude, projectData.longitude);
        for (const other of conflictingProjects) {
          try {
            await addDoc(collection(db, 'conflicts'), {
              projectId: docRef.id,
              conflictingProjectId: other.id,
              conflictType: 'Spatial',
              description: 'تعارض مكاني مكتشف تلقائياً عند الإضافة',
              detectedBy: 'System',
              status: 'Detected',
              createdAt: new Date().toISOString()
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'conflicts');
          }
        }
      }
      
      // Log action
      await this.logAction(docRef.id, projectData.createdBy, 'تم إنشاء المشروع', undefined, newProject.status as ProjectStatus);
      
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'projects');
      throw error;
    }
  },

  async updateProjectStatus(projectId: string, userId: string, newStatus: ProjectStatus, note: string) {
    const projectRef = doc(db, 'projects', projectId);
    try {
      await updateDoc(projectRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      await this.logAction(projectId, userId, 'تغيير حالة المشروع', undefined, newStatus, note);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}`);
    }
  },

  // Conflict Detection Utilities (Simple distance-based for now)
  async checkForConflicts(lat: number, lng: number, radiusKm: number = 0.1): Promise<boolean> {
    const projects = await this.findConflictingProjects(lat, lng, radiusKm);
    return projects.length > 0;
  },

  async findConflictingProjects(lat: number, lng: number, radiusKm: number = 0.1): Promise<any[]> {
    // Simple bounding box query (approximation)
    const latDelta = radiusKm / 111.32;
    const lngDelta = radiusKm / (111.32 * Math.cos(lat * (Math.PI / 180)));
    
    const q = query(
      collection(db, 'projects'),
      where('latitude', '>=', lat - latDelta),
      where('latitude', '<=', lat + latDelta)
      // Note: Firestore doesn't support multiple range inequalities on different fields
      // but we can filter longitude in memory or use Geohashes.
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }))
      .filter(p => p.status !== 'completed' && p.status !== 'cancelled' && 
                  Math.abs(p.longitude - lng) <= lngDelta);
  },

  // Logs
  async logAction(projectId: string, userId: string, action: string, oldStatus?: ProjectStatus, newStatus?: ProjectStatus, note: string = '') {
    try {
      await addDoc(collection(db, 'project_logs'), {
        projectId,
        userId,
        action,
        oldStatus,
        newStatus,
        note,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'project_logs');
    }
  },

  // Administrative Decisions (Wali/Admin)
  async issueDecision(decision: Omit<AdministrativeDecision, 'id' | 'createdAt'>) {
    try {
      const decisionRef = await addDoc(collection(db, 'administrative_decisions'), {
        ...decision,
        createdAt: new Date().toISOString()
      });
      
      // Also log the decision in project logs
      await this.logAction(
        decision.projectId, 
        decision.issuedByUserId, 
        `قرار إداري: ${decision.decisionType}`,
        undefined,
        undefined,
        decision.decisionText
      );

      return decisionRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'administrative_decisions');
    }
  },

  async resolveConflict(conflictId: string, projectId: string, userId: string, resolution: string) {
    try {
      const conflictRef = doc(db, 'conflicts', conflictId);
      await updateDoc(conflictRef, {
        status: 'Resolved',
        resolvedAt: new Date().toISOString()
      });
      
      await this.logAction(projectId, userId, 'تم حل التعارض بقرار إداري', undefined, undefined, resolution);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `conflicts/${conflictId}`);
    }
  },

  async updatePriority(projectId: string, userId: string, priority: 'Low' | 'Medium' | 'High' | 'Critical') {
    try {
      const projectRef = doc(db, 'projects', projectId);
      await updateDoc(projectRef, {
        priority,
        updatedAt: new Date().toISOString()
      });
      await this.logAction(projectId, userId, `تغيير الأولوية إلى: ${priority}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}`);
    }
  },

  async requestMeeting(projectId: string, userId: string, reason: string) {
    try {
      await this.logAction(projectId, userId, 'طلب اجتماع تنسيقي عاجل', undefined, undefined, reason);
      // In a real app, this might create a notification or a meeting record
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'projects');
    }
  },

  // Subscriptions
  subscribeToProjects(callback: (projects: Project[]) => void) {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'projects');
    });
  },

  subscribeToConflicts(callback: (conflicts: Conflict[]) => void) {
    const q = query(collection(db, 'conflicts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conflict)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'conflicts');
    });
  }
};
