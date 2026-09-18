"use client";

import { useState, useEffect } from "react";
import Papa from "papaparse";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { UploadCloud, CheckCircle2, AlertCircle, Plus, FileText, UserPlus, BarChart3, Download, Eye, X, PhoneCall, XCircle, Calendar, Phone, MessageCircle, Tag as TagIcon, Trash2 } from "lucide-react";

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
  contactByDate: string;
  status: string;
  followUpCount?: number;
  history?: HistoryEntry[];
  createdAt?: any;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"csv" | "manual" | "reports">("csv");
  
  // CSV State
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Manual Form State
  const [manualForm, setManualForm] = useState({
    name: "", email: "", phone: "", whatsapp: "", note: "", event: "", tag: "", contactBeforeDate: "", contactAtDate: "", contactAtTime: ""
  });
  const [saving, setSaving] = useState(false);

  // Reports State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [viewingDetails, setViewingDetails] = useState<Contact | null>(null);
  
  // Events State
  const [eventsList, setEventsList] = useState<{docId: string, id: string, name: string}[]>([]);
  const [newEventId, setNewEventId] = useState("");
  const [newEventName, setNewEventName] = useState("");

  // Report Filters
  const [reportFilterName, setReportFilterName] = useState("");
  const [reportFilterAddedDate, setReportFilterAddedDate] = useState("");
  const [reportFilterFollowUpDate, setFilterFollowUpDate] = useState("");
  const [reportFilterStatus, setReportFilterStatus] = useState("any");

  useEffect(() => {
    if (isAuthenticated) {
      // Fetch Events
      const qEvents = query(collection(db, "events"), orderBy("createdAt", "desc"));
      const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
        const evData: any[] = [];
        snapshot.forEach((doc) => {
          evData.push({ docId: doc.id, ...doc.data() });
        });
        setEventsList(evData);
      });

      // Fetch Reports if tab active
      if (activeTab === "reports") {
        setLoadingReports(true);
        const qContacts = query(collection(db, "contacts"), orderBy("createdAt", "desc"));
        const unsubscribeContacts = onSnapshot(qContacts, (snapshot) => {
          const contactsData: Contact[] = [];
          snapshot.forEach((doc) => {
            contactsData.push({ id: doc.id, ...doc.data() } as Contact);
          });
          setContacts(contactsData);
          setLoadingReports(false);
        }, (error) => {
          console.error("Error fetching reports:", error);
          setLoadingReports(false);
        });
        return () => {
          unsubscribeEvents();
          unsubscribeContacts();
        };
      }
      return () => unsubscribeEvents();
    }
  }, [isAuthenticated, activeTab]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "admin123") {
      setIsAuthenticated(true);
    } else {
      alert("Invalid password");
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setMessage(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const parsedContacts = results.data as any[];
          let count = 0;
          let skipped = 0;
          for (const contact of parsedContacts) {
            // Require Name and Phone
            if (!contact.name || !contact.phone) {
              skipped++;
              continue;
            }

            // Map event number to name if it matches an event ID
            let finalEventName = contact.event || "";
            if (finalEventName) {
              const matchedEvent = eventsList.find(e => String(e.id).trim() === String(finalEventName).trim());
              if (matchedEvent) {
                 finalEventName = matchedEvent.name;
              }
            }

            await addDoc(collection(db, "contacts"), {
              name: contact.name,
              email: contact.email || "",
              phone: contact.phone,
              whatsapp: contact.whatsapp || "",
              note: contact.note || "",
              event: finalEventName,
              tag: contact.tag || "",
              contactBeforeDate: contact.contactBeforeDate || contact.contactByDate || "",
              contactAtDate: contact.contactAtDate || "",
              contactAtTime: contact.contactAtTime || contact.contactByTime || "",
              status: "no_call", 
              followUpCount: 0,
              history: [],
              createdAt: serverTimestamp(),
            });
            count++;
          }
          const skipMsg = skipped > 0 ? ` Skipped ${skipped} rows missing Name or Phone.` : "";
          setMessage({ text: `Successfully imported ${count} contacts.${skipMsg}`, type: "success" });
          setFile(null);
        } catch (error) {
          console.error("Error uploading contacts: ", error);
          setMessage({ text: "Failed to upload contacts. Please check the file.", type: "error" });
        } finally {
          setUploading(false);
        }
      },
    });
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await addDoc(collection(db, "contacts"), {
        ...manualForm,
        status: "no_call", 
        followUpCount: 0,
        history: [],
        createdAt: serverTimestamp(),
      });
      setMessage({ text: `Successfully added ${manualForm.name}.`, type: "success" });
      setManualForm({ name: "", email: "", phone: "", whatsapp: "", note: "", event: "", tag: "", contactBeforeDate: "", contactAtDate: "", contactAtTime: "" });
    } catch (error) {
      console.error("Error adding contact manually:", error);
      setMessage({ text: "Failed to add contact.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventId || !newEventName) return;
    try {
      await addDoc(collection(db, "events"), {
        id: newEventId,
        name: newEventName,
        createdAt: serverTimestamp()
      });
      setNewEventId("");
      setNewEventName("");
      setMessage({ text: "Event created successfully.", type: "success" });
    } catch (err) {
      console.error("Error creating event:", err);
      setMessage({ text: "Failed to create event.", type: "error" });
    }
  };

  const handleDeleteEvent = async (docId: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the event "${name}"?`)) {
      try {
        await deleteDoc(doc(db, "events", docId));
        setMessage({ text: "Event deleted.", type: "success" });
      } catch (err) {
        setMessage({ text: "Failed to delete event.", type: "error" });
      }
    }
  };

  const handleDeleteLead = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to completely delete the lead "${name}"? This cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, "contacts", id));
        setMessage({ text: `Lead "${name}" was successfully deleted.`, type: "success" });
        if (viewingDetails && viewingDetails.id === id) {
          setViewingDetails(null);
        }
      } catch (err) {
        console.error("Error deleting lead:", err);
        setMessage({ text: "Failed to delete lead.", type: "error" });
      }
    }
  };

  const filteredReports = contacts.filter((c) => {
    const matchName = reportFilterName ? (c.name.toLowerCase().includes(reportFilterName.toLowerCase()) || (c.tag && c.tag.toLowerCase().includes(reportFilterName.toLowerCase()))) : true;
    
    let matchAdded = true;
    if (reportFilterAddedDate) {
      if (c.createdAt?.toDate) {
        const addedDateStr = c.createdAt.toDate().toLocaleDateString('en-CA');
        matchAdded = addedDateStr === reportFilterAddedDate;
      } else {
        matchAdded = false;
      }
    }

    const matchFollowUp = reportFilterFollowUpDate ? c.contactByDate === reportFilterFollowUpDate : true;

    let matchStatus = true;
    if (reportFilterStatus !== "any") {
      matchStatus = c.status === reportFilterStatus;
    }

    return matchName && matchAdded && matchFollowUp && matchStatus;
  });

  const downloadReportCSV = () => {
    if (filteredReports.length === 0) return;
    
    const csvData = filteredReports.map(c => {
      const lastCall = c.history && c.history.length > 0 ? c.history[c.history.length - 1] : null;
      return {
        Name: c.name,
        Phone: c.phone,
        Email: c.email,
        Event: c.event,
        Tag: c.tag,
        Status: c.status === "no_call" ? "No Call" : c.status === "called" ? "Call Back Later" : c.status,
        Total_Calls_Dialed: c.followUpCount || 0,
        Last_Call_Date: lastCall ? new Date(lastCall.date).toLocaleString() : "Never",
        Last_Call_Note: lastCall ? lastCall.note : "None",
        Initial_Note: c.note
      };
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Inkfetish_Call_Report_${new Date().toLocaleDateString()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  // Metrics (based on filtered results so admins can drill down)
  const totalLeads = filteredReports.length;
  let callsToday = 0;
  let totalAllTimeCalls = 0;

  const todayStr = new Date().toISOString().split('T')[0];

  filteredReports.forEach(c => {
    totalAllTimeCalls += (c.followUpCount || 0);
    if (c.history && c.history.length > 0) {
      c.history.forEach(h => {
        if (h.date && h.date.startsWith(todayStr)) {
          callsToday++;
        }
      });
    }
  });

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F5F7] font-sans">
        <form onSubmit={handleLogin} className="p-10 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 rounded-[24px] w-full max-w-sm flex flex-col items-center">
          <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center mb-6 shadow-sm">
             <UserPlus className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-semibold mb-2 text-center text-gray-900 tracking-tight">Admin Portal</h2>
          <p className="text-sm text-gray-500 mb-8 text-center">Enter your password to access</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 bg-gray-100/50 border-none rounded-xl mb-6 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            required
          />
          <button type="submit" className="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-sm">
            Continue
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans pb-20">
      <header className="bg-white/70 backdrop-blur-lg border-b border-gray-200/60 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Inkfetish Contacts Area</h1>
          <span className="bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1 rounded-full">Admin</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-12">
        <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 md:p-12">
          
          <div className="flex gap-4 mb-8 bg-gray-100/50 p-1.5 rounded-2xl w-fit">
            <button 
              onClick={() => { setActiveTab("csv"); setMessage(null); }}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${activeTab === "csv" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <FileText className="w-4 h-4" /> CSV Upload
            </button>
            <button 
              onClick={() => { setActiveTab("manual"); setMessage(null); }}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${activeTab === "manual" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <Plus className="w-4 h-4" /> Add Single Lead
            </button>
            <button 
              onClick={() => { setActiveTab("reports"); setMessage(null); }}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${activeTab === "reports" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <BarChart3 className="w-4 h-4" /> Reports
            </button>
            <button 
              onClick={() => { setActiveTab("events"); setMessage(null); }}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${activeTab === "events" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <Calendar className="w-4 h-4" /> Events
            </button>
          </div>

          <div className="w-full">
            {activeTab === "events" ? (
              <div className="max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h2 className="text-2xl font-semibold mb-2 text-gray-900 tracking-tight">Manage Events</h2>
                <p className="mb-8 text-sm text-gray-500 leading-relaxed">
                  Create numbered events. You can use these numbers in your CSV uploads or manual entries.
                </p>
                <form onSubmit={handleAddEvent} className="bg-white p-5 rounded-[20px] shadow-sm border border-gray-100 flex gap-4 items-end mb-8">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1 block mb-1">Event Number (ID)</label>
                    <input type="text" placeholder="e.g. 1" required value={newEventId} onChange={(e) => setNewEventId(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex-[2]">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1 block mb-1">Event Name</label>
                    <input type="text" placeholder="e.g. Summer Festival" required value={newEventName} onChange={(e) => setNewEventName(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <button type="submit" className="bg-black text-white px-5 py-2 rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors h-[38px]">
                    Create
                  </button>
                </form>

                <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider font-semibold border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3 w-24">Number</th>
                        <th className="px-5 py-3">Event Name</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {eventsList.length === 0 && (
                        <tr><td colSpan={3} className="text-center py-6 text-gray-500">No events found.</td></tr>
                      )}
                      {eventsList.map(ev => (
                        <tr key={ev.docId}>
                          <td className="px-5 py-3 font-semibold text-gray-900">{ev.id}</td>
                          <td className="px-5 py-3 font-medium text-gray-700">{ev.name}</td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => handleDeleteEvent(ev.docId, ev.name)} className="text-red-500 hover:text-red-700 p-1">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === "csv" ? (
              <div className="max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h2 className="text-2xl font-semibold mb-2 text-gray-900 tracking-tight">Import Leads</h2>
                <p className="mb-8 text-sm text-gray-500 leading-relaxed">
                  Upload your CSV file to instantly sync new contacts. Ensure headers include: 
                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mx-1">name, phone, email, whatsapp, note, event, tag, contactByDate, contactByTime</span>.
                </p>
                
                <form onSubmit={handleFileUpload} className="flex flex-col gap-6">
                  <div className="relative group cursor-pointer">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      required
                    />
                    <div className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-colors ${file ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50 group-hover:bg-gray-100'}`}>
                      <UploadCloud className={`w-8 h-8 mb-3 ${file ? 'text-blue-500' : 'text-gray-400'}`} />
                      <span className="text-sm font-medium text-gray-700">
                        {file ? file.name : "Choose CSV file or drag & drop"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={!file || uploading}
                    className="w-full bg-blue-500 text-white py-3.5 px-4 rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex justify-center items-center gap-2"
                  >
                    {uploading ? "Importing..." : "Upload Leads"}
                  </button>
                </form>
              </div>
            ) : activeTab === "manual" ? (
              <div className="max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h2 className="text-2xl font-semibold mb-2 text-gray-900 tracking-tight">Add Lead Manually</h2>
                <p className="mb-8 text-sm text-gray-500 leading-relaxed">Fill out the details below to add a single lead directly to the team board.</p>
                
                <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Name *</label>
                      <input required type="text" value={manualForm.name} onChange={(e) => setManualForm({...manualForm, name: e.target.value})} className="w-full px-4 py-2.5 bg-gray-100/50 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Phone *</label>
                      <input required type="tel" value={manualForm.phone} onChange={(e) => setManualForm({...manualForm, phone: e.target.value})} className="w-full px-4 py-2.5 bg-gray-100/50 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">WhatsApp (Optional)</label>
                      <input type="text" value={manualForm.whatsapp} onChange={(e) => setManualForm({...manualForm, whatsapp: e.target.value})} className="w-full px-4 py-2.5 bg-gray-100/50 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Email (Optional)</label>
                      <input type="email" value={manualForm.email} onChange={(e) => setManualForm({...manualForm, email: e.target.value})} className="w-full px-4 py-2.5 bg-gray-100/50 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Tags (Optional, comma separated, max 3)</label>
                      <input type="text" placeholder="e.g. VIP, Urgent" value={manualForm.tag} onChange={(e) => setManualForm({...manualForm, tag: e.target.value})} className="w-full px-4 py-2.5 bg-gray-100/50 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Event Name (Optional)</label>
                      <select 
                        value={manualForm.event} 
                        onChange={(e) => setManualForm({...manualForm, event: e.target.value})} 
                        className="w-full px-4 py-2.5 bg-gray-100/50 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                      >
                        <option value="">No Event</option>
                        {eventsList.map(ev => (
                          <option key={ev.docId} value={ev.name}>{ev.id} - {ev.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 flex flex-col gap-4 mt-2">
                    <h3 className="text-sm font-semibold text-blue-900">Scheduling (Optional)</h3>
                    
                    <div>
                      <label className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider mb-1 block">Contact Before (Date)</label>
                      <input type="date" value={manualForm.contactBeforeDate} onChange={(e) => setManualForm({...manualForm, contactBeforeDate: e.target.value})} className="w-full px-4 py-2.5 bg-white border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 appearance-none shadow-sm" />
                      <p className="text-[10px] text-blue-600/70 mt-1 ml-1">If the lead just needs a call by a certain day.</p>
                    </div>

                    <div className="border-t border-blue-200/50 pt-3">
                      <label className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider mb-2 block">OR Contact At Exactly (Date & Time)</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <input type="date" value={manualForm.contactAtDate} onChange={(e) => setManualForm({...manualForm, contactAtDate: e.target.value})} className="w-full px-4 py-2.5 bg-white border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 appearance-none shadow-sm" />
                        </div>
                        <div>
                          <input type="time" value={manualForm.contactAtTime} onChange={(e) => setManualForm({...manualForm, contactAtTime: e.target.value})} className="w-full px-4 py-2.5 bg-white border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 appearance-none shadow-sm" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Notes (Optional)</label>
                    <textarea value={manualForm.note} onChange={(e) => setManualForm({...manualForm, note: e.target.value})} placeholder="Add any background context..." className="w-full px-4 py-2.5 bg-gray-100/50 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 h-24 resize-none" />
                  </div>
                  <button type="submit" disabled={saving} className="w-full mt-2 bg-blue-500 text-white py-3.5 px-4 rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 transition-all shadow-sm">
                    {saving ? "Adding..." : "Add Lead"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Team Call Reports</h2>
                    <p className="text-sm text-gray-500">Live overview of all dialing activity.</p>
                  </div>
                  <button 
                    onClick={downloadReportCSV}
                    className="bg-black text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download Filtered CSV
                  </button>
                </div>
                
                {/* NEW FILTER BAR */}
                <div className="flex flex-wrap gap-4 mb-6 bg-white p-4 rounded-[20px] shadow-sm border border-gray-100">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1 block mb-1">Search Name / Tag</label>
                    <input 
                      type="text" 
                      placeholder="e.g. VIP..." 
                      className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 h-[38px]"
                      value={reportFilterName}
                      onChange={(e) => setReportFilterName(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1 block mb-1 flex justify-between items-center">
                      <span>Added Date</span>
                      {reportFilterAddedDate && <button onClick={()=>setReportFilterAddedDate('')} className="text-gray-400 hover:text-gray-800"><X size={12}/></button>}
                    </label>
                    <input 
                      type="date" 
                      className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 appearance-none h-[38px]"
                      value={reportFilterAddedDate}
                      onChange={(e) => setReportFilterAddedDate(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1 block mb-1 flex justify-between items-center">
                      <span>Contact Date</span>
                      {reportFilterFollowUpDate && <button onClick={()=>setFilterFollowUpDate('')} className="text-gray-400 hover:text-gray-800"><X size={12}/></button>}
                    </label>
                    <input 
                      type="date" 
                      className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 appearance-none h-[38px]"
                      value={reportFilterFollowUpDate}
                      onChange={(e) => setFilterFollowUpDate(e.target.value)}
                    />
                  </div>

                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1 block mb-1">Status</label>
                    <select 
                      className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 h-[38px] appearance-none cursor-pointer"
                      value={reportFilterStatus}
                      onChange={(e) => setReportFilterStatus(e.target.value)}
                    >
                      <option value="any">Any Status</option>
                      <option value="no_call">No Call</option>
                      <option value="called">Callback Later</option>
                      <option value="interested">Interested</option>
                      <option value="not_interested">Not Interested</option>
                      <option value="no_answer">No Answer</option>
                    </select>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Leads</div>
                    <div className="text-2xl font-bold text-gray-900">{totalLeads}</div>
                  </div>
                  <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                    <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Calls Logged Today</div>
                    <div className="text-2xl font-bold text-blue-700">{callsToday}</div>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total All-Time Calls</div>
                    <div className="text-2xl font-bold text-gray-900">{totalAllTimeCalls}</div>
                  </div>
                </div>

                {loadingReports ? (
                  <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin"></div></div>
                ) : (
                  <div className="border border-gray-100 rounded-2xl overflow-hidden overflow-x-auto shadow-sm">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider font-semibold border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4">Name</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Total Calls</th>
                          <th className="px-6 py-4">Last Activity</th>
                          <th className="px-6 py-4 text-right">View</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredReports.length === 0 ? (
                          <tr><td colSpan={5} className="text-center py-8 text-gray-500">No leads match your filters.</td></tr>
                        ) : filteredReports.map(c => {
                          const lastCall = c.history && c.history.length > 0 ? c.history[c.history.length - 1] : null;
                          const displayInfo = getStatusDisplay(c.status);
                          return (
                            <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4 font-medium text-gray-900">
                                <div>{c.name}</div>
                                {c.event && <div className="text-xs text-gray-500 uppercase mt-0.5">{c.event}</div>}
                                <div className="flex gap-1 flex-wrap mt-1.5">
                                  {c.tag && c.tag.split(',').map((t, i) => (
                                    <span key={i} className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-100">{t.trim()}</span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${displayInfo.color}`}>
                                  {displayInfo.text}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-semibold text-gray-700">{c.followUpCount || 0} calls</td>
                              <td className="px-6 py-4">
                                {lastCall ? (
                                  <div>
                                    <div className="text-xs font-medium text-gray-800">{getStatusDisplay(lastCall.outcome).text}</div>
                                    <div className="text-[10px] text-gray-400 mt-0.5">{new Date(lastCall.date).toLocaleDateString()}</div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">No activity yet</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => setViewingDetails(c)}
                                className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm"
                              >
                                <Eye size={14} /> Full Details
                              </button>
                              <button 
                                onClick={() => handleDeleteLead(c.id, c.name)}
                                className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm"
                                title="Delete Lead"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {message && activeTab !== "reports" && (
              <div className={`max-w-xl mt-6 p-4 rounded-xl flex items-start gap-3 text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                {message.text}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Admin Contact Details Modal */}
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
                  <span className="text-xs text-gray-500 font-medium">Total Calls Logged: {viewingDetails.followUpCount || 0}</span>
                </div>
              </div>
              <button onClick={() => setViewingDetails(null)} className="text-gray-400 hover:text-gray-800 p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"><X size={18} /></button>
            </div>
            
            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              
              {/* Lead Info Grid */}
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
                  {viewingDetails.contactByDate && (
                    <div>
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Next Contact Date</span>
                      <span className="text-gray-800 font-medium">
                        {viewingDetails.contactByDate} 
                        {viewingDetails.contactByTime ? ` at ${viewingDetails.contactByTime}` : ""}
                      </span>
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

              {/* Complete Call History Timeline */}
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Complete Call Log</h4>
              <div className="flex flex-col gap-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                {(!viewingDetails.history || viewingDetails.history.length === 0) ? (
                  <div className="text-center py-6 text-sm text-gray-400 italic">The team hasn't called this lead yet.</div>
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
          </div>
        </div>
      )}

    </div>
  );
}
