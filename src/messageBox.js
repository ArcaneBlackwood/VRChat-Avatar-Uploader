const { dialog, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

async function triggerMessage(text) {
    // Create a new BrowserWindow for the message dialog
    let win = new BrowserWindow({
        width: 1000,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Load a temporary HTML file with the raw text and set the font to Consolas
    const htmlContent = `
    <html>
    <head>
        <style>
            body {
                font-family: 'Consolas', monospace;
                white-space: pre;
                margin: 20px;
								background-color: #333;
								color: #fff;
            }
        </style>
    </head>
    <body>${text}</body>
    </html>`;



		const fileUrl = 'data:text/html;charset=UTF-8,' + encodeURIComponent(htmlContent);
    win.loadURL(fileUrl);
		

    // Wait until the window is closed
    await new Promise((resolve) => {
        win.on('closed', () => {
            resolve();
        });
    });

}

module.exports = { triggerMessage };