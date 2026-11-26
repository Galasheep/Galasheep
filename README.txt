GalaSheep website (rebuilt from Wix)
====================================

1. Double-click "1 - Download media.bat"
   Downloads all images and videos from your Wix site into site\media.
   Do this BEFORE cancelling Wix. You can run it again any time; it skips what it already has.

2. Double-click "2 - Preview site.bat"
   Opens the site at http://localhost:8080 in your browser. Close the black window to stop it.

3. Upload: the "site" folder is the whole website. Upload that folder to Cloudflare Pages
   (Workers & Pages > Create > Pages > Upload assets). The "tools" folder and these files are NOT part of the site.

Old Wix addresses (like /copy-of-project-page/torch-royale) redirect to the new ones automatically (site\_redirects).
