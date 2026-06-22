// Smart Notes — Firefox Extension Background Script

const API_URL = 'http://localhost:3000/api/notes';

// Create the context menu item when the extension is installed
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'send-to-notes',
    title: 'Send to Smart Notes ✨',
    contexts: ['selection']
  });
});

// Listen for context menu clicks
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'send-to-notes') {
    const selectedText = info.selectionText;
    if (selectedText) {
      sendToNotes(selectedText, info.pageUrl || tab?.url || null);
    }
  }
});

// Function to send the raw input to the Express server
async function sendToNotes(rawInput, sourceUrl) {
  try {
    // Show a notification that processing started
    browser.notifications.create('notes-processing', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Smart Notes',
      message: 'Processing knowledge with Gemini AI...'
    });

    const body = { rawInput };
    if (sourceUrl) body.sourceUrl = sourceUrl;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    // Clear the processing notification
    browser.notifications.clear('notes-processing');

    if (data.success) {
      browser.notifications.create('notes-success', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '✅ Note Saved Successfully',
        message: `Saved as: "${data.note.title}" (${data.note.category})`
      });
    } else {
      throw new Error(data.error || 'Unknown API Error');
    }

  } catch (error) {
    console.error('Error sending to Smart Notes:', error);
    browser.notifications.clear('notes-processing');
    browser.notifications.create('notes-error', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '❌ Failed to Save Note',
      message: `Error: ${error.message}. Is your server running?`
    });
  }
}
