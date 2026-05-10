import { db } from '../firebase';
import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';

export async function getNextSerialNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const counterRef = doc(db, 'metadata', 'counters');
  
  try {
    const serial = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let count = 1;
      
      if (counterDoc.exists()) {
        const data = counterDoc.data();
        if (data[year]) {
          count = data[year] + 1;
        }
      }
      
      transaction.set(counterRef, { [year]: count }, { merge: true });
      
      // Format: REP-YYYY-0000
      const formattedCount = count.toString().padStart(4, '0');
      return `REP-${year}-${formattedCount}`;
    });
    
    return serial;
  } catch (error) {
    console.error('Error generating serial number:', error);
    // Fallback to timestamp if transaction fails
    return `REP-${year}-${Date.now().toString().slice(-4)}`;
  }
}
