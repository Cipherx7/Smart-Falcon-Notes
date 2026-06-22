// Extension Background Script

const API_URL = 'https://smart-notes-app.vercel.app/api/notes';

// Create the context menu item when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'send-to-notes',
    title: 'Send to Smart Notes ✨',
    contexts: ['selection']
  });
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'send-to-notes') {
    const selectedText = info.selectionText;
    if (selectedText) {
      sendToNotes(selectedText);
    }
  }
});

// Function to send the raw input to the Express server
async function sendToNotes(rawInput) {
  try {
    // Show a notification that processing started
    chrome.notifications.create('notes-processing', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Smart Notes',
      message: 'Processing knowledge with Gemini AI...',
      priority: 0
    });

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rawInput })
    });

    const data = await response.json();

    // Clear the processing notification
    chrome.notifications.clear('notes-processing');

    if (data.success) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '✅ Note Saved Successfully',
        message: `Saved as: "${data.note.title}" (${data.note.category})`,
        priority: 1
      });
    } else {
      throw new Error(data.error || 'Unknown API Error');
    }

  } catch (error) {
    console.error('Error sending to Smart Notes:', error);
    chrome.notifications.clear('notes-processing');
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '❌ Failed to Save Note',
      message: `Error: ${error.message}. Is your local server running on port 3000?`,
      priority: 2
    });
  }
}
