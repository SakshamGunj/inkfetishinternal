"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { Phone, MessageCircle, Calendar, Tag as TagIcon, Plus, X, PhoneCall, CheckCircle2, XCircle, LayoutGrid, List, FileText, Clock } from "lucide-react";

interface HistoryEntry {
  date: string;
  outcome: string;
  note: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  note: string;
  event: string;
  tag: string;
  contactByDate?: string; // Legacy
  contactByTime?: string; // Legacy
  contactBeforeDate?: string;
  contactAtDate?: string;
  contactAtTime?: string;
  status: string;
  followUpCount?: number;
  history?: HistoryEntry[];
  createdAt?: { toDate?: () => Date };
}

interface EventData {
  docId: string;
  id: string;
  name: string;
}

export default function Home() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterTag, setFilterTag] = useState("");
  const [filterEvent, setFilterEvent] = useState("any");
  const [filterAddedDate, setFilterAddedDate] = useState("");
  const [filterFollowUpDate, setFilterFollowUpDate] = useState("");
  const [filterCallCount, setFilterCallCount] = useState("any");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [eventsList, setEventsList] = useState<EventData[]>([]);
  
  // Modals State
  const [loggingCall, setLoggingCall] = useState<Contact | null>(null);
  const [viewingDetails, setViewingDetails] = useState<Contact | null>(null);

  // Form State for Logging Call
  const [callOutcome, setCallOutcome] = useState("called");
  const [callNote, setCallNote] = useState("");
  const [nextContactBeforeDate, setNextContactBeforeDate] = useState("");
  const [nextContactAtDate, setNextContactAtDate] = useState("");
  const [nextContactAtTime, setNextContactAtTime] = useState("");

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      // Fetch Contacts
      const qContacts = query(collection(db, "contacts"), orderBy("createdAt", "desc"));
      const unsubscribeContacts = onSnapshot(qContacts, (snapshot) => {
        const contactsData: Contact[] = [];
        snapshot.forEach((doc) => {
          contactsData.push({ id: doc.id, ...doc.data() } as Contact);
        });
        setContacts(contactsData);
        
        // If a user is viewing details, update the details object in real-time
        setViewingDetails((prev) => {
          if (!prev) return null;
          const updated = contactsData.find(c => c.id === prev.id);
          return updated || null;
        });

        setLoading(false);
      }, (error) => {
        console.error("Error fetching contacts:", error);
        setLoading(false);
      });

      // Fetch Events
      const qEvents = query(collection(db, "events"));
      const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
        const evData: EventData[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data(); evData.push({ docId: doc.id, id: data.id, name: data.name });
        });
        setEventsList(evData.sort((a, b) => Number(a.id) - Number(b.id)));
      }, (error: Error) => console.error("Event Snapshot Error:", error));

      return () => { unsubscribeContacts(); unsubscribeEvents(); };
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginEmail.toLowerCase() === "salonikanchal@gmail.com" && loginPassword === "saloni@123") {
      setIsAuthenticated(true);
      setLoginError("");
    } else {
      setLoginError("Invalid credentials.");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-[20px] p-8 shadow-sm border border-gray-100">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Partner Login</h1>
            <p className="text-sm text-gray-500 mt-2">Inkfetish Contacts Area</p>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Email</label>
              <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required className="w-full px-4 py-3 bg-gray-50/50 border border-gray-100 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="Enter your email" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Password</label>
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className="w-full px-4 py-3 bg-gray-50/50 border border-gray-100 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="••••••••" />
            </div>
            {loginError && <p className="text-red-500 text-sm font-medium text-center">{loginError}</p>}
            <button type="submit" className="w-full bg-black text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors mt-2 h-[42px]">
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  const submitCallLog = async () => {
    if (!loggingCall) return;

    try {
      const currentCount = loggingCall.followUpCount || 0;
      const historyEntry = {
        date: new Date().toISOString(),
        outcome: callOutcome,
        note: callNote
      };

      const updateData: Record<string, unknown> = {
        status: callOutcome,
        followUpCount: currentCount + 1,
        history: arrayUnion(historyEntry)
      };

      if (nextContactBeforeDate) {
        updateData.contactBeforeDate = nextContactBeforeDate;
        updateData.contactAtDate = ""; // clear the other type
        updateData.contactAtTime = "";
      } else if (nextContactAtDate) {
        updateData.contactAtDate = nextContactAtDate;
        updateData.contactAtTime = nextContactAtTime;
        updateData.contactBeforeDate = ""; // clear the other type
      }

      await updateDoc(doc(db, "contacts", loggingCall.id), updateData);
      
      setLoggingCall(null);
      setCallOutcome("called");
      setCallNote("");
      setNextContactBeforeDate("");
      setNextContactAtDate("");
      setNextContactAtTime("");
    } catch (error) {
      console.error("Error logging call:", error);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    const matchTag = filterTag ? (c.tag || "").toLowerCase().includes(filterTag.toLowerCase()) : true;
    
    let matchAdded = true;
    if (filterAddedDate) {
      if (c.createdAt?.toDate) {
        const addedDateStr = c.createdAt.toDate().toLocaleDateString('en-CA'); // gets YYYY-MM-DD
        matchAdded = addedDateStr === filterAddedDate;
      } else {
        matchAdded = false;
      }
    }

    const matchFollowUp = filterFollowUpDate 
      ? (c.contactByDate === filterFollowUpDate || c.contactBeforeDate === filterFollowUpDate || c.contactAtDate === filterFollowUpDate) 
      : true;

    let matchCallCount = true;
    if (filterCallCount !== "any") {
      const count = c.followUpCount || 0;
      if (filterCallCount === "0") matchCallCount = count === 0;
      else if (filterCallCount === "1") matchCallCount = count === 1;
      else if (filterCallCount === "2") matchCallCount = count === 2;
      else if (filterCallCount === "3+") matchCallCount = count >= 3;
    }

    const matchEvent = filterEvent !== "any" ? c.event === filterEvent : true;

    return matchTag && matchEvent && matchFollowUp && matchAdded && matchCallCount;
  });

  const getStatusDisplay = (status: string) => {
    switch(status) {
      case 'interested': return { text: 'Interested', color: 'bg-green-100 text-green-700' };
      case 'not_interested': return { text: 'Not Interested', color: 'bg-red-100 text-red-700' };
      case 'no_answer': return { text: 'No Answer', color: 'bg-yellow-100 text-yellow-700' };
      case 'called': return { text: 'Callback Later', color: 'bg-blue-100 text-blue-700' };
      case 'no_call': return { text: 'No Call', color: 'bg-gray-100 text-gray-600' };
      default: return { text: 'No Call', color: 'bg-gray-100 text-gray-600' };
    }
  };

  const getContactSchedule = (c: Contact) => {
    if (c.contactBeforeDate || c.contactByDate) {
      return `Call Before: ${c.contactBeforeDate || c.contactByDate}`;
    } else if (c.contactAtDate) {
      return `Call At: ${c.contactAtDate} ${c.contactAtTime ? `(${c.contactAtTime})` : ""}`;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-gray-900 font-sans pb-20">
      <header className="bg-white/70 backdrop-blur-xl border-b border-gray-200/60 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-sm">
              <Phone className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Inkfetish Contacts Area</h1>
          </div>
          
          <div className="flex flex-wrap gap-4 w-full xl:w-auto items-end">
            <div className="flex bg-gray-100/80 rounded-xl p-1 mb-[2px]">
              <button 
                onClick={() => setViewMode("grid")} 
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                title="Grid View"
              >
                <LayoutGrid size={16} />
              </button>
              <button 
                onClick={() => setViewMode("list")} 
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                title="List View"
              >
                <List size={16} />
              </button>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 block mb-1">Search Tag</label>
              <input 
                type="text" 
                placeholder="e.g. VIP..." 
                className="w-full px-3 py-2 bg-gray-100/80 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 h-[38px] transition-all"
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
              />
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 block mb-1">Event</label>
              <select 
                className="w-full px-3 py-2 bg-gray-100/80 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 appearance-none h-[38px] cursor-pointer"
                value={filterEvent}
                onChange={(e) => setFilterEvent(e.target.value)}
              >
                <option value="any">Any Event</option>
                {eventsList.map(ev => (
                  <option key={ev.docId} value={ev.name}>{ev.name}</option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 min-w-[130px] xl:w-32 flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1">Calls Logged</span>
              <select 
                className="w-full px-3 py-2 bg-gray-100/80 border-none rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow h-[38px] cursor-pointer appearance-none"
                value={filterCallCount}
                onChange={(e) => setFilterCallCount(e.target.value)}
              >
                <option value="any">Any Amount</option>
                <option value="0">0 Calls (New)</option>
                <option value="1">1 Call</option>
                <option value="2">2 Calls</option>
                <option value="3+">3+ Calls</option>
              </select>
            </div>
            
            <div className="relative flex-1 min-w-[140px] xl:w-36 flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1 flex justify-between">
                <span>Added Date</span>
                {filterAddedDate && <button onClick={()=>setFilterAddedDate('')} className="text-gray-400 hover:text-gray-800"><X size={12}/></button>}
              </span>
              <input 
                type="date" 
                className="w-full px-3 py-2 bg-gray-100/80 border-none rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow appearance-none h-[38px]"
                value={filterAddedDate}
                onChange={(e) => setFilterAddedDate(e.target.value)}
              />
            </div>
            
            <div className="relative flex-1 min-w-[140px] xl:w-36 flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1 flex justify-between">
                <span>Contact Date</span>
                {filterFollowUpDate && <button onClick={()=>setFilterFollowUpDate('')} className="text-gray-400 hover:text-gray-800"><X size={12}/></button>}
              </span>
              <input 
                type="date" 
                className="w-full px-3 py-2 bg-gray-100/80 border-none rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow appearance-none h-[38px]"
                value={filterFollowUpDate}
                onChange={(e) => setFilterFollowUpDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin"></div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No matching leads</h3>
            <p className="text-sm text-gray-500">Try adjusting your filters or wait for admin assignments.</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredContacts.map(contact => {
              const followUpCount = contact.followUpCount || 0;
              const displayInfo = getStatusDisplay(contact.status);
              const addedDateStr = contact.createdAt?.toDate ? contact.createdAt.toDate().toLocaleDateString() : 'Unknown';

              return (
                <div key={contact.id} className="bg-white rounded-[20px] shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-100 p-5 flex flex-col hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all">
                  
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg tracking-tight text-gray-900 leading-tight mb-1">{contact.name}</h3>
                      <div className="flex flex-col gap-0.5">
                        {contact.event && <span className="text-xs font-medium text-gray-500 tracking-wide uppercase">{contact.event}</span>}
                        <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1"><Clock size={10} /> Added: {addedDateStr}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${displayInfo.color} shrink-0 ml-2`}>
                      {displayInfo.text}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-3 flex-1">
                    <div className="flex flex-col gap-2 mb-2">
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-2.5 text-sm font-medium text-gray-700 hover:text-blue-500 transition-colors bg-gray-50 px-3 py-2 rounded-xl">
                          <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-md flex items-center justify-center shrink-0">
                             <Phone size={14} /> 
                          </div>
                          <span className="truncate">{contact.phone}</span>
                        </a>
                      )}
                      {contact.whatsapp && (
                        <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 text-sm font-medium text-gray-700 hover:text-green-500 transition-colors bg-gray-50 px-3 py-2 rounded-xl">
                          <div className="w-6 h-6 bg-green-100 text-green-600 rounded-md flex items-center justify-center shrink-0">
                            <MessageCircle size={14} />
                          </div>
                          <span className="truncate">WhatsApp</span>
                        </a>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {getContactSchedule(contact) && (
                        <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-1 rounded-md text-[11px] font-medium border border-yellow-100">
                          <Calendar size={10} /> {getContactSchedule(contact)}
                        </span>
                      )}
                      {contact.tag && contact.tag.split(',').map((t, i) => (
                        <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[11px] font-medium border border-blue-100">
                          <TagIcon size={10} /> {t.trim()}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto pt-4 border-t border-gray-100">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Calls Dialed: {followUpCount}
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setViewingDetails(contact)}
                          className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <FileText size={16} /> Details
                        </button>
                        <button 
                          onClick={() => {
                            setLoggingCall(contact);
                            setNextContactBeforeDate(contact.contactBeforeDate || contact.contactByDate || "");
                            setNextContactAtDate(contact.contactAtDate || "");
                            setNextContactAtTime(contact.contactAtTime || "");
                          }}
                          className="flex-1 bg-black text-white hover:bg-gray-800 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <Plus size={16} /> Log Call
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-[24px] shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider font-semibold border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">Name / Info</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Status & Dates</th>
                    <th className="px-6 py-4">Activity</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredContacts.map(contact => {
                    const followUpCount = contact.followUpCount || 0;
                    const displayInfo = getStatusDisplay(contact.status);
                    const addedDateStr = contact.createdAt?.toDate ? contact.createdAt.toDate().toLocaleDateString() : 'Unknown';

                    return (
                      <tr key={contact.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{contact.name}</div>
                          {contact.event && <div className="text-xs text-gray-500 uppercase mt-0.5">{contact.event}</div>}
                          <div className="flex gap-1 flex-wrap mt-1.5">
                            {contact.tag && contact.tag.split(',').map((t, i) => (
                              <span key={i} className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-100">{t.trim()}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            {contact.phone && (
                              <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-gray-600 hover:text-blue-500">
                                <Phone size={12} className="text-blue-500" /> <span>{contact.phone}</span>
                              </a>
                            )}
                            {contact.whatsapp && (
                              <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-gray-600 hover:text-green-500">
                                <MessageCircle size={12} className="text-green-500" /> <span>WhatsApp</span>
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${displayInfo.color}`}>
                              {displayInfo.text}
                            </span>
                            <div className="text-[10px] text-gray-500 flex flex-col gap-0.5">
                              <span><strong className="text-gray-400 font-medium">Added:</strong> {addedDateStr}</span>
                              {getContactSchedule(contact) && <span className="text-yellow-700 font-medium bg-yellow-50 px-1 rounded"><strong className="text-yellow-600/70 font-medium">Scheduled:</strong> {getContactSchedule(contact)}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-600">Calls Dialed: {followUpCount}</span>
                          </div>
                          {contact.history && contact.history.length > 0 && (
                            <div className="text-[10px] text-gray-400 mt-1 truncate max-w-[120px]">
                              Last Note: {contact.history[contact.history.length - 1].note || "No notes"}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setViewingDetails(contact)}
                              className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm"
                            >
                              <FileText size={12} /> Details
                            </button>
                            <button 
                              onClick={() => {
                                setLoggingCall(contact);
                                setNextContactBeforeDate(contact.contactBeforeDate || contact.contactByDate || "");
                                setNextContactAtDate(contact.contactAtDate || "");
                                setNextContactAtTime(contact.contactAtTime || "");
                              }}
                              className="inline-flex items-center gap-1.5 bg-black text-white hover:bg-gray-800 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm"
                            >
                              <Plus size={12} /> Log Call
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Contact Details Modal */}
      {viewingDetails && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#F5F5F7] rounded-[24px] shadow-2xl overflow-hidden w-full max-w-lg max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 border border-gray-200">
            {/* Header */}
            <div className="bg-white px-6 py-5 border-b border-gray-200 flex justify-between items-start shrink-0">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-gray-900 mb-1">{viewingDetails.name}</h3>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${getStatusDisplay(viewingDetails.status).color}`}>
                    {getStatusDisplay(viewingDetails.status).text}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">Calls Dialed: {viewingDetails.followUpCount || 0}</span>
                </div>
              </div>
              <button onClick={() => setViewingDetails(null)} className="text-gray-400 hover:text-gray-800 p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"><X size={18} /></button>
            </div>
            
            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              
              {/* Contact Info Grid */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Lead Information</h4>
                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                  {viewingDetails.phone && (
                    <div>
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Phone</span>
                      <a href={`tel:${viewingDetails.phone}`} className="text-blue-600 hover:underline">{viewingDetails.phone}</a>
                    </div>
                  )}
                  {viewingDetails.whatsapp && (
                    <div>
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">WhatsApp</span>
                      <a href={`https://wa.me/${viewingDetails.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">{viewingDetails.whatsapp}</a>
                    </div>
                  )}
                  {viewingDetails.email && (
                    <div className="col-span-2">
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Email</span>
                      <span className="text-gray-800">{viewingDetails.email}</span>
                    </div>
                  )}
                  {viewingDetails.event && (
                    <div>
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Event</span>
                      <span className="text-gray-800">{viewingDetails.event}</span>
                    </div>
                  )}
                  {viewingDetails.tag && (
                    <div className="col-span-2">
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Tags</span>
                      <div className="flex gap-1.5 flex-wrap mt-1">
                        {viewingDetails.tag.split(',').map((t, i) => (
                          <span key={i} className="text-blue-700 bg-blue-50 px-2 py-1 rounded text-xs font-medium border border-blue-100">{t.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {getContactSchedule(viewingDetails) && (
                    <div className="col-span-2">
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Next Contact Scheduled</span>
                      <span className="text-gray-800 font-medium bg-yellow-50 px-2 py-1 rounded inline-block mt-0.5 border border-yellow-100">
                        {getContactSchedule(viewingDetails)}
                      </span>
                    </div>
                  )}
                  {viewingDetails.createdAt && (
                    <div>
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Lead Added Date</span>
                      <span className="text-gray-800">{viewingDetails.createdAt.toDate ? viewingDetails.createdAt.toDate().toLocaleDateString() : 'Unknown'}</span>
                    </div>
                  )}
                </div>
                {viewingDetails.note && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Admin Initial Note</span>
                    <p className="text-gray-700 text-sm leading-relaxed">{viewingDetails.note}</p>
                  </div>
                )}
              </div>

              {/* Call History Timeline */}
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Call History & Notes</h4>
              <div className="flex flex-col gap-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                {(!viewingDetails.history || viewingDetails.history.length === 0) ? (
                  <div className="text-center py-6 text-sm text-gray-400 italic">No calls have been logged yet.</div>
                ) : (
                  viewingDetails.history.map((h, i) => {
                    const dateObj = new Date(h.date);
                    return (
                      <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#F5F5F7] bg-white shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                          {h.outcome === 'interested' ? <CheckCircle2 size={16} className="text-green-500"/> : h.outcome === 'not_interested' ? <XCircle size={16} className="text-red-500"/> : <PhoneCall size={16} className="text-blue-500"/>}
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-gray-900 text-sm">{getStatusDisplay(h.outcome).text}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-2">
                            {dateObj.toLocaleDateString()} at {dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                          <div className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-2 rounded-lg">{h.note || <span className="italic text-gray-400">No notes provided</span>}</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            
            {/* Footer Action */}
            <div className="bg-white p-4 border-t border-gray-200 shrink-0">
               <button 
                  onClick={() => {
                    setViewingDetails(null);
                    setLoggingCall(viewingDetails);
                    setNextContactBeforeDate(viewingDetails.contactBeforeDate || viewingDetails.contactByDate || "");
                    setNextContactAtDate(viewingDetails.contactAtDate || "");
                    setNextContactAtTime(viewingDetails.contactAtTime || "");
                  }}
                  className="w-full bg-black text-white hover:bg-gray-800 py-3 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Log New Call
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Logging Modal */}
      {loggingCall && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[24px] shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-semibold tracking-tight text-gray-900">Log Call: {loggingCall.name}</h3>
              <button onClick={() => setLoggingCall(null)} className="text-gray-400 hover:text-gray-800 p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"><X size={18} /></button>
            </div>
            
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Outcome</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'called', label: 'Call Back Later', icon: <PhoneCall size={14} /> },
                    { id: 'no_answer', label: 'No Answer', icon: <XCircle size={14} /> },
                    { id: 'interested', label: 'Interested', icon: <CheckCircle2 size={14} /> },
                    { id: 'not_interested', label: 'Not Interested', icon: <XCircle size={14} /> }
                  ].map(opt => (
                    <button 
                      key={opt.id}
                      onClick={() => setCallOutcome(opt.id)}
                      className={`py-2.5 px-3 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${callOutcome === opt.id ? 'bg-black text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Notes (What did they say?)</label>
                <textarea 
                  value={callNote}
                  onChange={(e) => setCallNote(e.target.value)}
                  placeholder="Enter details about the conversation..."
                  className="w-full h-24 px-4 py-3 bg-gray-100/50 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 resize-none outline-none"
                  autoFocus
                />
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Schedule Next Call (Optional)</h4>
                
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-600 uppercase mb-1 block">Contact Before (Date)</label>
                    <input 
                      type="date"
                      value={nextContactBeforeDate}
                      onChange={(e) => setNextContactBeforeDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 appearance-none shadow-sm"
                    />
                  </div>

                  <div className="border-t border-gray-200 pt-3 relative">
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gray-50 px-2 text-[10px] font-bold text-gray-400 uppercase">OR</span>
                    <label className="text-[10px] font-semibold text-gray-600 uppercase mb-1 block">Contact At Exactly (Date & Time)</label>
                    <div className="grid grid-cols-2 gap-3">
                      <input 
                        type="date"
                        value={nextContactAtDate}
                        onChange={(e) => setNextContactAtDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 appearance-none shadow-sm"
                      />
                      <input 
                        type="time"
                        value={nextContactAtTime}
                        onChange={(e) => setNextContactAtTime(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 appearance-none shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={submitCallLog}
                disabled={!callNote && callOutcome === 'interested'}
                className="w-full bg-blue-500 text-white py-3.5 rounded-xl font-medium hover:bg-blue-600 transition-colors shadow-sm mt-1 disabled:opacity-50"
              >
                Save & Update Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
