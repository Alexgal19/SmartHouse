import { google } from 'googleapis';

import { Readable } from 'stream';

// Using the provided specific Google Drive Folder ID
const GOOGLE_DRIVE_FOLDER_ID = '13pwuMw2Ki-Oj2vxNJDlT73y1bDUFZrCL';

export async function uploadFileToDrive(
    fileName: string,
    mimeType: string,
    fileBuffer: Buffer
): Promise<{ url: string, error?: string }> {
    try {
        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const key = process.env.GOOGLE_PRIVATE_KEY;

        const auth = new google.auth.JWT({
            email,
            key: key?.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        const drive = google.drive({ version: 'v3', auth });

        // Convert buffer to stream
        const stream = new Readable();
        stream.push(fileBuffer);
        stream.push(null);

        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [GOOGLE_DRIVE_FOLDER_ID],
            },
            media: {
                mimeType,
                body: stream,
            },
            fields: 'id, webViewLink, webContentLink',
        });

        // Try to generate a direct thumbnail link if possible, or use webViewLink
        const fileId = response.data.id;
        
        if (!fileId) {
            return { url: '', error: 'Nie udało się wgrać pliku' };
        }

        // By default, webViewLink is the preview. We'll return webContentLink if available
        // since it's the download/direct link, or fallback to webViewLink.
        // Actually, a universally viewable link that shows purely the image is best. 
        // We will grant "anyone with link" reader permissions on the file to ensure it's viewable by the web app without auth headers.
        
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        const updatedFile = await drive.files.get({
            fileId: fileId,
            fields: 'webViewLink, webContentLink',
        });

        // webContentLink is better for <img src="..." /> though it may force download in browsers natively. 
        // Often, changing the URL to 'https://drive.google.com/thumbnail?id=FILE_ID&sz=w1000' works great for embedded images.
        const thumbnailOrDirectUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;

        return { url: thumbnailOrDirectUrl };

    } catch (error: any) {
        console.error('Error uploading file to Google Drive:', error);
        return { url: '', error: error.message || 'Wystąpił błąd podczas wgrywania pliku' };
    }
}
