<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js and MongoDB (local or MongoDB Atlas cluster)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   Create a `.env` file in the root directory with:
   ```env
   MONGODB_URI=mongodb://localhost:27017/certificationbootcamp
   # Or for MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/certificationbootcamp
   DB_NAME=certificationbootcamp
   PORT=3001
   ```
   
   For the frontend, create a `.env.local` file (optional):
   ```env
   VITE_API_URL=http://localhost:3001/api
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. Run the application:
   - **Option 1: Run both server and frontend together:**
     ```bash
     npm run dev:full
     ```
   - **Option 2: Run separately:**
     ```bash
     # Terminal 1: Start the backend server
     npm run server
     
     # Terminal 2: Start the frontend
     npm run dev
     ```

4. Access the app:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
