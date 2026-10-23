import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Format timestamp into readable time and date string
 */
export function formatSubmissionTiming(timestamp) {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    });
}

/**
 * Export Bug Snap and Debug Arena participant lists to an Excel (.xlsx) file.
 */
export function exportParticipantsToExcel({
    eventName = "BUG BATTLE",
    bugSnapList = [],
    debugArenaList = []
}) {
    const workbook = XLSX.utils.book_new();

    // 1. Bug Snap Sheet
    const bugSnapData = bugSnapList.map((t, idx) => ({
        "Sl. No": idx + 1,
        "Team Name": t.teamName || "—",
        "Total points": t.totalPoints ?? t.phase1Score ?? 0,
        "Timing of final submission": formatSubmissionTiming(t.submittedAt || t.bugSnapSubmittedAt)
    }));
    const bugSnapSheet = XLSX.utils.json_to_sheet(bugSnapData);
    bugSnapSheet["!cols"] = [
        { wch: 10 },
        { wch: 28 },
        { wch: 15 },
        { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(workbook, bugSnapSheet, "Bug Snap");

    // 2. Debug Arena Sheet
    const debugArenaData = debugArenaList.map((t, idx) => ({
        "Sl. No": idx + 1,
        "Team Name": t.teamName || "—",
        "Total points": t.totalPoints ?? t.phase2Score ?? 0,
        "Timing of final submission": formatSubmissionTiming(t.submittedAt || t.debugArenaSubmittedAt)
    }));
    const debugArenaSheet = XLSX.utils.json_to_sheet(debugArenaData);
    debugArenaSheet["!cols"] = [
        { wch: 10 },
        { wch: 28 },
        { wch: 15 },
        { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(workbook, debugArenaSheet, "Debug Arena");

    const safeName = (eventName || "Bug_Battle").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${safeName}_Participants.xlsx`;
    XLSX.writeFile(workbook, fileName);
}

/**
 * Export Bug Snap and Debug Arena participant lists to a formatted PDF (.pdf) file.
 */
export function exportParticipantsToPDF({
    eventName = "BUG BATTLE",
    bugSnapList = [],
    debugArenaList = []
}) {
    const doc = new jsPDF("p", "pt", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 75, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(eventName.toUpperCase() + " — PARTICIPANT LIST", 40, 38);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Generated on: ${new Date().toLocaleString()} • Sorted by Points (Decreasing) & Final Submission Timing`, 40, 56);

    let startY = 95;

    // --- Section 1: Bug Snap Participants ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text("Phase 1: Bug Snap Participants", 40, startY);

    const bugSnapRows = bugSnapList.map((t, idx) => [
        idx + 1,
        t.teamName || "—",
        t.totalPoints ?? t.phase1Score ?? 0,
        formatSubmissionTiming(t.submittedAt || t.bugSnapSubmittedAt)
    ]);

    autoTable(doc, {
        startY: startY + 10,
        head: [["Sl. No", "Team Name", "Total points", "Timing of final submission"]],
        body: bugSnapRows.length > 0 ? bugSnapRows : [["—", "No participants", "0", "—"]],
        theme: "striped",
        headStyles: {
            fillColor: [37, 99, 235], // blue-600
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: "bold"
        },
        bodyStyles: {
            fontSize: 9,
            textColor: [51, 65, 85]
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            0: { cellWidth: 50, halign: "center" },
            1: { cellWidth: 180 },
            2: { cellWidth: 90, halign: "center", fontStyle: "bold" },
            3: { cellWidth: 195 }
        },
        margin: { left: 40, right: 40 }
    });

    // --- Section 2: Debug Arena Participants ---
    const afterBugSnapY = doc.lastAutoTable.finalY + 30;

    // Check if we need a new page
    if (afterBugSnapY > doc.internal.pageSize.getHeight() - 120) {
        doc.addPage();
        startY = 50;
    } else {
        startY = afterBugSnapY;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("Phase 2: Debug Arena Participants", 40, startY);

    const debugArenaRows = debugArenaList.map((t, idx) => [
        idx + 1,
        t.teamName || "—",
        t.totalPoints ?? t.phase2Score ?? 0,
        formatSubmissionTiming(t.submittedAt || t.debugArenaSubmittedAt)
    ]);

    autoTable(doc, {
        startY: startY + 10,
        head: [["Sl. No", "Team Name", "Total points", "Timing of final submission"]],
        body: debugArenaRows.length > 0 ? debugArenaRows : [["—", "No participants", "0", "—"]],
        theme: "striped",
        headStyles: {
            fillColor: [124, 58, 237], // violet-600
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: "bold"
        },
        bodyStyles: {
            fontSize: 9,
            textColor: [51, 65, 85]
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            0: { cellWidth: 50, halign: "center" },
            1: { cellWidth: 180 },
            2: { cellWidth: 90, halign: "center", fontStyle: "bold" },
            3: { cellWidth: 195 }
        },
        margin: { left: 40, right: 40 }
    });

    const safeName = (eventName || "Bug_Battle").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${safeName}_Participants.pdf`;
    doc.save(fileName);
}
