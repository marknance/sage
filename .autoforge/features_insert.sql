-- ============================================================================
-- Sage: Personal AI Expert Studio - 105 Features Insert Script
-- Categories: Infrastructure (5), Security & Access Control (10),
--   Navigation Integrity (5), Real Data Verification (5), Workflow Completeness (10),
--   Error Handling (8), UI-Backend Integration (8), State & Persistence (5),
--   URL & Direct Access (5), Double-Action & Idempotency (4),
--   Data Cleanup & Cascade (5), Default & Reset (4), Search & Filter Edge Cases (4),
--   Form Validation (5), Feedback & Notification (4), Responsive & Layout (3),
--   Accessibility (3), Temporal & Timezone (2), Concurrency & Race Conditions (2),
--   Export/Import (3), Performance (5)
-- ============================================================================

-- ==========================================================================
-- CATEGORY 0: Infrastructure (IDs 1-5, no dependencies)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(1, 1, 'functional', 'Database connection established',
 'Verify that the backend server successfully connects to the SQLite database and the GET /api/health endpoint returns a healthy status indicating database connectivity.',
 '["Start the backend server on port 3001","Send GET request to /api/health","Verify response status is 200","Verify response JSON contains a db_status or status field indicating healthy/connected","Verify no database connection errors appear in server logs","Send a second GET /api/health request to confirm persistent connectivity","Verify the response time is under 500ms","Check that the SQLite database file exists on disk at the expected path","Verify the health endpoint returns valid JSON content-type header","Confirm the database file is not zero bytes"]',
 0, 0, '[]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(2, 2, 'functional', 'Database schema applied correctly',
 'Verify that all required database tables exist with the correct columns and constraints as defined in the project specification.',
 '["Connect to the SQLite database file directly","Verify the users table exists with columns: id, username, email, password_hash, role, created_at, updated_at","Verify the ai_backends table exists with columns: id, user_id, name, type, base_url, api_key, org_id, is_active, created_at","Verify the experts table exists with columns: id, user_id, name, description, domain, personality_tone, system_prompt, backend_id, model_override, memory_enabled, last_used_at, created_at, updated_at","Verify the expert_behaviors table exists with columns: id, expert_id, behavior_key, enabled","Verify the expert_categories table exists with columns: id, user_id, name, created_at","Verify the expert_category_map table exists with columns: id, expert_id, category_id","Verify the expert_memories table exists with columns: id, expert_id, memory_type, content, source_conversation_id, created_at, updated_at","Verify the conversations table exists with columns: id, user_id, title, type, expert_debate_enabled, auto_suggest_experts, created_at, updated_at","Verify the conversation_experts table exists with columns: id, conversation_id, expert_id, backend_override_id, model_override","Verify the messages table exists with columns: id, conversation_id, expert_id, role, content, created_at","Verify the documents table exists with columns: id, conversation_id, filename, file_type, file_path, file_size, extracted_text, created_at","Verify the settings table exists with columns: id, user_id, theme, default_backend_id, default_model, updated_at"]',
 0, 0, '[]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(3, 3, 'functional', 'Data persists across server restart',
 'Verify that data written to the database survives a full server restart and can be retrieved intact afterward.',
 '["Start the backend server","Register a new user via POST /api/auth/register with email test_persist@example.com","Verify registration succeeds with 201 status","Stop the backend server completely","Restart the backend server","Send POST /api/auth/login with the same credentials","Verify login succeeds and returns valid JWT","Verify the user data returned matches what was registered","Query GET /api/auth/me and confirm user profile data is intact","Check that created_at timestamp was preserved across restart"]',
 0, 0, '[]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(4, 4, 'functional', 'No mock data patterns in codebase',
 'Verify that the codebase does not contain mock data, hardcoded fake responses, or in-memory data stores that bypass the real database.',
 '["Search all backend source files for patterns like mock, fake, stub, dummy data arrays","Search for in-memory arrays used as data stores (e.g., const users = [])","Search for hardcoded JSON response objects that bypass database queries","Verify no TODO comments indicate planned database replacement","Search for setTimeout or delay patterns that simulate API responses","Verify that route handlers import and use the database module","Check that no route returns static/hardcoded data instead of querying SQLite","Verify there are no seed files that populate mock data on every server start","Search for patterns like res.json followed by hardcoded arrays or objects","Confirm all CRUD endpoints contain SQL queries or database calls"]',
 0, 0, '[]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(5, 5, 'functional', 'Backend API queries real database',
 'Verify that API endpoints actually execute SQL queries against the SQLite database rather than returning fabricated data.',
 '["Register a user via POST /api/auth/register","Verify the user row exists in the SQLite users table by querying the database file directly","Create an expert via POST /api/experts","Verify the expert row exists in the SQLite experts table by querying the database file directly","Verify that GET /api/experts returns the same data that exists in the database","Delete the expert via DELETE /api/experts/:id","Verify the expert row is removed from the database file","Create a conversation and verify it exists in the conversations table","Send a message and verify it exists in the messages table","Verify all API responses contain real database-generated IDs (auto-increment integers)"]',
 0, 0, '[]');

-- ==========================================================================
-- CATEGORY A: Security & Access Control (IDs 6-15)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(6, 6, 'functional', 'User registration creates account with hashed password',
 'Verify that POST /api/auth/register creates a new user with a bcrypt-hashed password and returns a valid JWT cookie.',
 '["Send POST /api/auth/register with valid email, username, and password (8+ chars)","Verify response status is 201","Verify response body contains user id, email, and username","Verify a Set-Cookie header is present with an HttpOnly JWT cookie","Query the database directly and verify password_hash is not the plain text password","Verify the password_hash starts with $2b$ or $2a$ (bcrypt prefix)","Verify the user role defaults to user","Verify created_at timestamp is set"]',
 0, 0, '[1,2,3,4,5]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(7, 7, 'functional', 'User login returns JWT in HttpOnly cookie',
 'Verify that POST /api/auth/login authenticates the user and returns a JWT stored in an HttpOnly cookie.',
 '["Register a test user via POST /api/auth/register","Send POST /api/auth/login with correct credentials","Verify response status is 200","Verify Set-Cookie header contains a token with HttpOnly flag","Verify the cookie has a reasonable expiry (7 days)","Decode the JWT and verify it contains the user id","Use the cookie to call GET /api/auth/me","Verify the authenticated response returns correct user data"]',
 0, 0, '[1,2,3,4,5]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(8, 8, 'functional', 'User logout clears session cookie',
 'Verify that POST /api/auth/logout clears the JWT cookie and subsequent authenticated requests fail.',
 '["Login as a valid user and obtain JWT cookie","Verify GET /api/auth/me succeeds with the cookie","Send POST /api/auth/logout","Verify the Set-Cookie header clears or expires the token","Send GET /api/auth/me again without a valid cookie","Verify the response is 401 Unauthorized"]',
 0, 0, '[1,2,3,4,5]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(9, 9, 'functional', 'Protected routes reject unauthenticated requests',
 'Verify that all API routes under /api/experts, /api/conversations, /api/settings, and /api/admin return 401 when no valid JWT cookie is provided.',
 '["Send GET /api/experts without authentication","Verify response is 401","Send GET /api/conversations without authentication","Verify response is 401","Send GET /api/settings without authentication","Verify response is 401","Send GET /api/admin/users without authentication","Verify response is 401","Send POST /api/experts without authentication","Verify response is 401"]',
 0, 0, '[1,2,3,4,5]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(10, 10, 'functional', 'Admin routes return 403 for non-admin users',
 'Verify that /api/admin/* endpoints return 403 Forbidden when accessed by a user with the regular user role.',
 '["Register and login as a regular user (role=user)","Send GET /api/admin/users with user JWT","Verify response is 403 Forbidden","Send POST /api/admin/users with user JWT","Verify response is 403","Send PUT /api/admin/users/1 with user JWT","Verify response is 403","Send DELETE /api/admin/users/1 with user JWT","Verify response is 403","Login as admin and verify GET /api/admin/users returns 200"]',
 0, 0, '[1,2,3,4,5]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(11, 11, 'functional', 'Password change requires correct current password',
 'Verify that PUT /api/auth/password requires the current password to be correct before allowing a password change.',
 '["Register and login as a test user","Send PUT /api/auth/password with wrong current password and valid new password","Verify response is 400 or 401 with error message","Send PUT /api/auth/password with correct current password and valid new password","Verify response is 200","Logout and login with the new password","Verify login succeeds","Try logging in with the old password","Verify login fails"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(12, 12, 'functional', 'Admin can create new user accounts',
 'Verify that an admin user can create new user accounts via POST /api/admin/users with specified roles.',
 '["Login as admin user","Send POST /api/admin/users with email, username, password, and role=user","Verify response is 201 with new user data","Verify the created user can login with the specified credentials","Send POST /api/admin/users with role=admin","Verify the new admin can access /api/admin/users","Verify both users appear in GET /api/admin/users list"]',
 0, 0, '[1,2,3,4,5,10]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(13, 13, 'functional', 'Admin can edit user roles',
 'Verify that an admin can change a user role from user to admin and vice versa via PUT /api/admin/users/:id.',
 '["Login as admin","Create a regular user via POST /api/admin/users","Send PUT /api/admin/users/:id with role=admin","Verify response is 200","Verify the user now has admin access by logging in as them and hitting GET /api/admin/users","Change the role back to user via PUT /api/admin/users/:id","Verify admin access is revoked (403 on /api/admin/users)"]',
 0, 0, '[1,2,3,4,5,10,12]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(14, 14, 'functional', 'Admin can delete user accounts',
 'Verify that an admin can delete user accounts via DELETE /api/admin/users/:id and the deleted user can no longer login.',
 '["Login as admin","Create a test user via POST /api/admin/users","Note the user ID","Send DELETE /api/admin/users/:id","Verify response is 200","Verify the user no longer appears in GET /api/admin/users","Attempt to login as the deleted user","Verify login fails"]',
 0, 0, '[1,2,3,4,5,10,12]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(15, 15, 'functional', 'Duplicate email registration is rejected',
 'Verify that attempting to register with an email that already exists returns an appropriate error.',
 '["Register a user with email unique@test.com","Attempt to register another user with the same email unique@test.com","Verify the response is 400 or 409 with an error message about duplicate email","Verify only one user with that email exists in the database"]',
 0, 0, '[1,2,3,4,5,6]');

-- ==========================================================================
-- CATEGORY B: Navigation Integrity (IDs 16-20)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(16, 16, 'functional', 'Sidebar navigation links render correctly for user role',
 'Verify that the left sidebar shows Expert Library, Conversations, and Settings links for regular users, and additionally Admin for admin users.',
 '["Login as a regular user","Verify sidebar contains Expert Library link","Verify sidebar contains Conversations link","Verify sidebar contains Settings link","Verify sidebar does NOT contain Admin link","Logout and login as admin","Verify sidebar contains Admin link","Verify all other links still present for admin"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(17, 17, 'functional', 'Navigation between all main views works without errors',
 'Verify that clicking each sidebar link navigates to the correct page without console errors or blank screens.',
 '["Login as admin user","Click Expert Library in sidebar","Verify Expert Library page renders","Click Conversations in sidebar","Verify Conversations page renders","Click Settings in sidebar","Verify Settings page renders with tabs","Click Admin in sidebar","Verify Admin panel renders","Navigate back to Expert Library","Verify no console errors during any navigation"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(18, 18, 'functional', 'Unauthenticated users are redirected to login page',
 'Verify that accessing any /app route without authentication redirects to /login.',
 '["Clear all cookies/session data","Navigate to /app/experts in the browser","Verify redirect to /login page","Navigate to /app/conversations","Verify redirect to /login page","Navigate to /app/settings","Verify redirect to /login page","Navigate to /app/admin","Verify redirect to /login page"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(19, 19, 'functional', 'Settings page tabs switch content correctly',
 'Verify that clicking Appearance, AI Backends, Account, and Admin tabs on the Settings page loads the correct panel content.',
 '["Login as admin","Navigate to Settings page","Click Appearance tab","Verify theme toggle is visible","Click AI Backends tab","Verify backend configuration cards or Add Backend button is visible","Click Account tab","Verify profile info and change password form are visible","Click Admin tab (admin only)","Verify user management table is visible","Verify tab indicator highlights the active tab"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(20, 20, 'functional', 'Expert creation wizard step navigation works',
 'Verify that the 6-step Expert creation wizard allows forward and backward navigation with step indicator updating correctly.',
 '["Login and navigate to Expert Library","Click New Expert button","Verify Step 1 (Name + Description) is shown with step indicator showing 1 of 6","Fill in name and description, click Next","Verify Step 2 (Domain) is shown with indicator at 2 of 6","Click Back","Verify Step 1 is shown again with previously entered data intact","Click Next through all steps up to Step 6","Verify Step 6 shows system prompt preview and Create Expert button","Verify step indicator updates correctly at each step"]',
 0, 0, '[1,2,3,4,5,6,7]');

-- ==========================================================================
-- CATEGORY C: Real Data Verification (IDs 21-25)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(21, 21, 'functional', 'Expert creation stores data in real database',
 'Verify that creating an Expert via the API stores a real row in the experts table with all specified fields.',
 '["Login as a user","Send POST /api/experts with name, domain, personality_tone, description","Verify response is 201 with expert data including a real auto-increment ID","Query the SQLite experts table directly","Verify a row exists matching the returned ID","Verify all fields (name, domain, personality_tone, description) match what was sent","Verify user_id matches the authenticated user","Verify created_at timestamp is set"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(22, 22, 'functional', 'Conversation messages stored in real database',
 'Verify that sending messages in a conversation stores them in the messages table with correct conversation_id and role.',
 '["Login and create an expert","Create a conversation via POST /api/conversations","Send a user message via POST /api/conversations/:id/messages","Query the SQLite messages table directly","Verify a row exists with role=user and the correct content","Verify conversation_id matches the created conversation","Verify created_at timestamp is set","Verify the message ID is a real auto-increment integer"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(23, 23, 'functional', 'Backend configuration stored in real database',
 'Verify that adding an AI backend stores the configuration in the ai_backends table.',
 '["Login as a user","Send POST /api/backends with name=TestOllama, type=ollama, base_url=http://localhost:11434","Verify response is 201","Query the SQLite ai_backends table directly","Verify a row exists with the correct name, type, and base_url","Verify user_id matches the authenticated user","Verify is_active defaults to 1"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(24, 24, 'functional', 'Expert memory entries stored in database',
 'Verify that adding a memory to an Expert stores it in the expert_memories table with correct type and content.',
 '["Login and create an Expert","Send POST /api/experts/:id/memory with content and memory_type=manual","Verify response is 201","Query the SQLite expert_memories table directly","Verify a row exists with the correct expert_id, content, and memory_type","Verify created_at is set","Send GET /api/experts/:id/memory","Verify the returned list includes the created memory"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(25, 25, 'functional', 'User settings stored in database',
 'Verify that updating user settings via PUT /api/settings stores the values in the settings table.',
 '["Login as a user","Send PUT /api/settings with theme=light","Verify response is 200","Query the SQLite settings table directly","Verify a row exists for the user with theme=light","Send PUT /api/settings with theme=dark","Query the database again and verify theme=dark","Verify GET /api/settings returns the updated values"]',
 0, 0, '[1,2,3,4,5,6]');

-- ==========================================================================
-- CATEGORY D: Workflow Completeness (IDs 26-35)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(26, 26, 'functional', 'Full Expert CRUD lifecycle',
 'Verify the complete create, read, update, and delete lifecycle for an Expert including all fields.',
 '["Login as a user","Create an Expert via POST /api/experts with all fields","Verify GET /api/experts returns the expert in the list","Verify GET /api/experts/:id returns full expert details","Update the expert name and domain via PUT /api/experts/:id","Verify GET /api/experts/:id returns updated data","Delete the expert via DELETE /api/experts/:id","Verify GET /api/experts no longer includes the deleted expert","Verify GET /api/experts/:id returns 404"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(27, 27, 'functional', 'Full conversation lifecycle with messages',
 'Verify the complete create, send messages, list, resume, and delete lifecycle for a conversation.',
 '["Login and create an Expert","Create a conversation via POST /api/conversations with the expert","Send a message via POST /api/conversations/:id/messages","Verify GET /api/conversations/:id/messages returns the message","Send a second message","Verify both messages appear in order","Rename the conversation via PUT /api/conversations/:id with new title","Verify GET /api/conversations/:id shows updated title","Delete the conversation via DELETE /api/conversations/:id","Verify GET /api/conversations no longer includes it"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(28, 28, 'functional', 'Full AI backend CRUD lifecycle',
 'Verify the complete create, read, update, and delete lifecycle for AI backend configurations.',
 '["Login as a user","Add an Ollama backend via POST /api/backends","Verify it appears in GET /api/backends list","Update the backend URL via PUT /api/backends/:id","Verify the update is reflected in GET /api/backends/:id","Delete the backend via DELETE /api/backends/:id","Verify it no longer appears in GET /api/backends"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(29, 29, 'functional', 'Expert memory CRUD lifecycle',
 'Verify the complete create, read, update, and delete lifecycle for Expert memory entries.',
 '["Login and create an Expert","Add a manual memory via POST /api/experts/:id/memory","Verify GET /api/experts/:id/memory includes the new memory","Update the memory content via PUT /api/experts/:id/memory/:memId","Verify the updated content appears in GET response","Delete the memory via DELETE /api/experts/:id/memory/:memId","Verify the memory no longer appears in the list","Add two more memories","Clear all memories via DELETE /api/experts/:id/memory","Verify GET /api/experts/:id/memory returns empty list"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(30, 30, 'functional', 'Expert category assignment and management',
 'Verify that categories can be created, assigned to Experts, and used for filtering.',
 '["Login as a user","Create a category via POST /api/categories with name=Legal","Create another category with name=Science","Create an Expert and assign it the Legal category","Create another Expert and assign it the Science category","Verify GET /api/experts?category=Legal returns only the Legal expert","Verify GET /api/categories returns both categories","Delete the Legal category","Verify the category association is removed from the expert"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(31, 31, 'functional', 'Document upload and association with conversation',
 'Verify that uploading a document to a conversation stores the file and associates it correctly.',
 '["Login and create an Expert and a conversation","Upload a TXT file via POST /api/conversations/:id/documents (multipart)","Verify response is 201 with document metadata (filename, file_type, file_size)","Verify GET /api/conversations/:id returns the document in the conversation data","Verify the file is stored on disk in the uploads directory","Remove the document via DELETE /api/conversations/:id/documents/:docId","Verify the document no longer appears in the conversation"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(32, 32, 'functional', 'Multi-expert conversation creation and message routing',
 'Verify that a multi-expert conversation can be created with multiple Experts and messages are properly attributed.',
 '["Login and create two Experts (Expert A and Expert B)","Create a conversation with type=multi_expert and both experts","Verify the conversation_experts table has two rows for this conversation","Send a message to the conversation","Verify GET /api/conversations/:id/messages includes expert attribution","Verify conversation appears in GET /api/conversations?type=multi_expert"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(33, 33, 'functional', 'Crossfire conversation with per-expert model assignment',
 'Verify that a Crossfire conversation allows assigning different backends/models to each Expert.',
 '["Login and create two Experts and two backends","Create a conversation with type=crossfire","Assign Expert A to backend 1 and Expert B to backend 2 via conversation_experts","Verify GET /api/conversations/:id includes the per-expert model assignments","Verify the conversation is labeled as crossfire type","Verify it appears in conversation list filtered by type=crossfire"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(34, 34, 'functional', 'Expert creation wizard produces valid Expert with system prompt',
 'Verify that completing all 6 steps of the Expert creation wizard results in a properly configured Expert with auto-generated system prompt.',
 '["Login and navigate to Expert Library","Click New Expert button","Step 1: Enter name=Tax Advisor, description=Federal tax expert","Step 2: Enter domain=Federal Tax Law","Step 3: Select personality=formal","Step 4: Enable cite_sources and summarize_end behaviors","Step 5: Skip model override (use default)","Step 6: Review the generated system prompt preview","Click Create Expert","Verify the Expert appears in the library with correct name and domain","Verify GET /api/experts/:id returns a non-empty system_prompt field","Verify expert_behaviors table has rows for the enabled behaviors"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(35, 35, 'functional', 'Conversation history list with search and filter',
 'Verify that conversations are listed in the history sidebar and can be searched by title and filtered by Expert.',
 '["Login and create two Experts","Create 3 conversations with different titles and Experts","Navigate to Conversations page","Verify all 3 conversations appear in the history sidebar","Search for a specific title in the search field","Verify only the matching conversation appears","Clear search and filter by Expert","Verify only conversations with that Expert are shown","Click a conversation to load its messages"]',
 0, 0, '[1,2,3,4,5,6,7]');

-- ==========================================================================
-- CATEGORY E: Error Handling (IDs 36-43)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(36, 36, 'functional', 'Invalid login shows clear error message',
 'Verify that attempting to login with incorrect credentials displays a user-friendly error message.',
 '["Navigate to /login","Enter a valid email but wrong password","Click Login","Verify an error message is displayed (e.g., Invalid email or password)","Verify the error message does not leak whether the email exists","Enter a non-existent email","Click Login","Verify a similar generic error message is shown","Verify no stack traces or technical details are exposed"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(37, 37, 'functional', 'API returns proper error for non-existent resources',
 'Verify that requesting non-existent Experts, conversations, or other resources returns 404 with a meaningful error message.',
 '["Login as a user","Send GET /api/experts/99999","Verify response is 404 with error message","Send GET /api/conversations/99999","Verify response is 404","Send DELETE /api/experts/99999","Verify response is 404","Send PUT /api/experts/99999 with valid body","Verify response is 404","Verify error responses are JSON with a message field"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(38, 38, 'functional', 'Missing required fields return 400 validation error',
 'Verify that API endpoints return 400 Bad Request when required fields are missing from the request body.',
 '["Login as a user","Send POST /api/experts with empty body","Verify response is 400 with validation error about missing fields","Send POST /api/auth/register with missing password","Verify response is 400","Send POST /api/auth/register with missing email","Verify response is 400","Send POST /api/backends with missing type","Verify response is 400","Verify all error responses include descriptive messages"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(39, 39, 'functional', 'Users cannot access other users Experts',
 'Verify that a user cannot view, edit, or delete Experts belonging to a different user.',
 '["Register and login as User A","Create an Expert as User A, note the ID","Register and login as User B","Send GET /api/experts/:id (User A Expert ID) as User B","Verify response is 404 or 403","Send PUT /api/experts/:id as User B","Verify response is 404 or 403","Send DELETE /api/experts/:id as User B","Verify response is 404 or 403","Verify User A Expert still exists when User A checks"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(40, 40, 'functional', 'Users cannot access other users conversations',
 'Verify that a user cannot view or interact with conversations belonging to a different user.',
 '["Register and login as User A","Create a conversation and send a message as User A","Register and login as User B","Send GET /api/conversations/:id (User A conversation) as User B","Verify response is 404 or 403","Send POST /api/conversations/:id/messages as User B","Verify response is 404 or 403","Send DELETE /api/conversations/:id as User B","Verify response is 404 or 403"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(41, 41, 'functional', 'Backend connection test handles unreachable server',
 'Verify that POST /api/backends/:id/test returns a clear failure status when the backend server is unreachable.',
 '["Login as a user","Create a backend with base_url=http://localhost:99999 (non-existent port)","Send POST /api/backends/:id/test","Verify response indicates connection failure (not a 500 crash)","Verify the error message is user-friendly (e.g., Connection refused or Timeout)","Verify the backend status shows failed/disconnected","Create a backend with base_url=http://invalid-host-that-does-not-exist.local","Send POST /api/backends/:id/test","Verify it returns a timeout or DNS resolution error gracefully"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(42, 42, 'functional', 'Upload of unsupported file type is rejected',
 'Verify that uploading a file with an unsupported extension returns a clear error instead of crashing.',
 '["Login and create a conversation","Attempt to upload a .exe file via POST /api/conversations/:id/documents","Verify response is 400 or 415 with error about unsupported file type","Attempt to upload a .zip file","Verify similar rejection","Verify the conversation is unchanged (no phantom document entries)"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(43, 43, 'functional', 'Password too short is rejected at registration',
 'Verify that registering with a password shorter than 8 characters returns a validation error.',
 '["Send POST /api/auth/register with a 7-character password","Verify response is 400 with error about password length","Send POST /api/auth/register with a 3-character password","Verify response is 400","Send POST /api/auth/register with an 8-character password","Verify registration succeeds with 201","Verify no user was created for the rejected attempts"]',
 0, 0, '[1,2,3,4,5,6]');

-- ==========================================================================
-- CATEGORY F: UI-Backend Integration (IDs 44-51)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(44, 44, 'functional', 'Expert library displays experts from API',
 'Verify that the Expert Library page fetches and displays all user Experts from GET /api/experts.',
 '["Login and create 3 Experts via API with different names and domains","Navigate to Expert Library page","Verify all 3 Expert cards are rendered","Verify each card shows the Expert name","Verify each card shows the domain chip","Verify each card shows a quick-chat button","Verify the expert count is displayed in the header"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(45, 45, 'functional', 'Expert library grid and list view toggle',
 'Verify that toggling between grid and list view on the Expert Library page changes the layout correctly.',
 '["Login and create 2+ Experts","Navigate to Expert Library","Verify default view is grid (cards layout)","Click list view toggle","Verify layout changes to compact table/row style","Verify all Expert data is still visible in list view","Click grid view toggle","Verify layout returns to card grid","Verify view preference persists on page reload"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(46, 46, 'functional', 'Expert library sorting works correctly',
 'Verify that sorting Experts by alphabetical, recently used, and category works via the sort dropdown.',
 '["Login and create 3 Experts: Alpha (domain=A), Beta (domain=B), Charlie (domain=C)","Navigate to Expert Library","Select sort by Alphabetical A-Z","Verify order is Alpha, Beta, Charlie","Select sort by Alphabetical Z-A","Verify order is Charlie, Beta, Alpha","Use one Expert in a conversation to update its last_used_at","Select sort by Recently Used","Verify the recently used Expert appears first"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(47, 47, 'functional', 'Chat interface sends messages and displays responses',
 'Verify that the chat UI sends user messages to the API and displays both user and Expert messages correctly.',
 '["Login and create an Expert with a configured backend","Start a new conversation with the Expert","Type a message in the input field","Click Send","Verify the user message appears in the chat feed","Verify a typing/streaming indicator appears","Verify the Expert response appears with the Expert name badge","Verify the message shows a timestamp","Verify markdown formatting is rendered in the response","Verify the input field is cleared after sending"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(48, 48, 'functional', 'AI Backends settings page lists configured backends',
 'Verify that the AI Backends tab on the Settings page displays all configured backends with status badges.',
 '["Login and add 2 backends via API (one Ollama, one OpenAI)","Navigate to Settings > AI Backends tab","Verify both backends are displayed as cards","Verify each card shows the backend name","Verify each card shows the backend type","Verify each card shows a connection status badge","Verify an Add Backend button is present","Verify a Test Connection button is present on each card"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(49, 49, 'functional', 'Admin panel lists all users in the system',
 'Verify that the Admin panel displays a table of all registered users with email, role, and registration date.',
 '["Login as admin","Create 2 additional users via POST /api/admin/users","Navigate to Admin panel","Verify a table of users is displayed","Verify each row shows email, role, and registration date","Verify action buttons (edit, delete) are present per row","Verify the admin user themselves appears in the list"]',
 0, 0, '[1,2,3,4,5,10,12]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(50, 50, 'functional', 'Theme toggle switches between light and dark mode',
 'Verify that toggling the theme on the Appearance settings tab switches CSS classes and persists the preference.',
 '["Login as a user","Navigate to Settings > Appearance tab","Verify current theme is dark (default)","Toggle to light mode","Verify the page background and text colors change to light theme values","Verify PUT /api/settings was called with theme=light","Refresh the page","Verify the light theme persists after refresh","Toggle back to dark mode","Verify dark theme is applied"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(51, 51, 'functional', 'Conversation title is editable inline',
 'Verify that clicking the conversation title in the chat header allows editing it and the change persists.',
 '["Login and create a conversation","Navigate to the conversation","Verify the title is shown in the top bar (default: New Conversation)","Click the title to enter edit mode","Change the title to My Custom Title","Press Enter or click away to save","Verify PUT /api/conversations/:id is called with the new title","Verify the title updates in the chat header","Verify the title updates in the conversation history sidebar","Refresh and verify the title persists"]',
 0, 0, '[1,2,3,4,5,6,7]');

-- ==========================================================================
-- CATEGORY G: State & Persistence (IDs 52-56)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(52, 52, 'functional', 'Theme preference persists across sessions',
 'Verify that the user theme choice is stored in the database and applied when the user logs in from a new session.',
 '["Login and set theme to light via Settings","Logout","Login again","Verify the light theme is applied on page load","Verify GET /api/settings returns theme=light","Switch to dark","Logout and login again","Verify dark theme is applied"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(53, 53, 'functional', 'Conversation messages persist and reload correctly',
 'Verify that messages sent in a conversation are fully loaded when the conversation is resumed later.',
 '["Login and start a conversation with an Expert","Send 3 messages (receiving 3 Expert responses)","Navigate away from the conversation page","Navigate back and click the conversation in history","Verify all 6 messages (3 user + 3 expert) are loaded in order","Verify timestamps are correct","Verify markdown formatting is still rendered","Logout and login again","Verify the conversation and all messages are still accessible"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(54, 54, 'functional', 'Expert behavior toggles persist after save',
 'Verify that enabling/disabling Expert behavior toggles saves to the database and persists when the Expert is viewed again.',
 '["Login and create an Expert","Edit the Expert and enable cite_sources and ask_clarifying behaviors","Save the Expert","Navigate away from the Expert detail page","Navigate back to the Expert detail page","Verify cite_sources is still toggled on","Verify ask_clarifying is still toggled on","Verify other behaviors remain off","Query expert_behaviors table to confirm database state"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(55, 55, 'functional', 'Session persists across browser refresh',
 'Verify that a logged-in user remains authenticated after refreshing the browser page.',
 '["Login as a user","Verify GET /api/auth/me returns user data","Refresh the browser page","Verify the user is still logged in (not redirected to /login)","Verify GET /api/auth/me still returns user data","Verify the sidebar shows the correct username","Navigate to Expert Library and verify data loads"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(56, 56, 'functional', 'Global default backend preference persists',
 'Verify that setting a global default backend and model stores in the settings table and is used by new conversations.',
 '["Login and add two backends","Set backend 1 as global default via PUT /api/settings with default_backend_id and default_model","Verify GET /api/settings returns the correct defaults","Create a new Expert without a model override","Start a conversation with this Expert","Verify the system uses the global default backend","Change global default to backend 2","Verify GET /api/settings reflects the change"]',
 0, 0, '[1,2,3,4,5,6]');

-- ==========================================================================
-- CATEGORY H: URL & Direct Access (IDs 57-61)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(57, 57, 'functional', 'Direct URL to Expert detail page loads correctly',
 'Verify that navigating directly to an Expert detail URL (e.g., /app/experts/1) loads the correct Expert data.',
 '["Login and create an Expert, note its ID","Navigate directly to /app/experts/:id via URL bar","Verify the Expert detail page renders with correct name","Verify domain, personality, and behaviors are displayed","Verify system prompt preview is visible"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(58, 58, 'functional', 'Direct URL to conversation loads messages',
 'Verify that navigating directly to a conversation URL loads all messages and conversation metadata.',
 '["Login, create an Expert, create a conversation, send 2 messages","Navigate directly to /app/conversations/:id via URL bar","Verify the conversation title is displayed","Verify all messages are loaded and visible","Verify the Expert badge is shown","Verify the input field is ready for new messages"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(59, 59, 'functional', 'Direct URL to non-existent Expert shows 404 or error',
 'Verify that navigating to /app/experts/99999 shows an appropriate not-found message rather than crashing.',
 '["Login as a user","Navigate directly to /app/experts/99999","Verify a not-found message or error state is displayed","Verify no blank screen or unhandled error","Verify navigation sidebar still works","Verify the user can navigate back to Expert Library"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(60, 60, 'functional', 'Direct URL to Settings page loads with correct tab',
 'Verify that navigating to the Settings page URL loads the page with the default tab active.',
 '["Login as a user","Navigate directly to /app/settings via URL bar","Verify the Settings page renders","Verify the Appearance tab is active by default","Verify the theme toggle is visible","Verify tab navigation works from this state"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(61, 61, 'functional', 'Direct URL to Admin panel enforces access control',
 'Verify that directly navigating to /app/admin as a non-admin user shows 403 or redirects.',
 '["Login as a regular user","Navigate directly to /app/admin via URL bar","Verify a 403 error or access denied message is displayed","Verify the user is not shown admin content","Logout and login as admin","Navigate to /app/admin","Verify the admin panel loads correctly"]',
 0, 0, '[1,2,3,4,5,6,7,10]');

-- ==========================================================================
-- CATEGORY I: Double-Action & Idempotency (IDs 62-65)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(62, 62, 'functional', 'Double-clicking delete Expert does not cause errors',
 'Verify that rapidly clicking the delete button for an Expert twice does not result in duplicate delete requests causing errors.',
 '["Login and create an Expert","Open the Expert detail page","Click the Delete button","Confirm the deletion dialog","Rapidly click confirm again before the first request completes","Verify the Expert is deleted successfully (no 500 error)","Verify no duplicate error messages appear","Verify the Expert Library shows the Expert as removed"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(63, 63, 'functional', 'Double-submitting a message does not create duplicates',
 'Verify that rapidly clicking Send twice in a conversation does not create duplicate user messages.',
 '["Login and start a conversation","Type a message in the input field","Rapidly click Send twice","Wait for responses","Verify only one copy of the user message appears in the chat","Verify GET /api/conversations/:id/messages shows only one user message for that content","Verify the Send button is disabled while a message is being sent"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(64, 64, 'functional', 'Double-clicking Create Expert does not create duplicates',
 'Verify that clicking Create Expert multiple times on the wizard final step does not create multiple Experts.',
 '["Login and go through Expert creation wizard to Step 6","Click Create Expert button","Rapidly click it again","Verify only one Expert is created in the library","Verify GET /api/experts does not show duplicates","Verify the Create button is disabled after first click"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(65, 65, 'functional', 'Double-registration with same email is handled gracefully',
 'Verify that submitting the registration form twice quickly with the same email does not create duplicate accounts.',
 '["Navigate to registration page","Fill in email=double@test.com, username, password","Rapidly click Register twice","Verify only one account is created","Verify second attempt shows appropriate error or is silently handled","Verify database has exactly one user with email=double@test.com"]',
 0, 0, '[1,2,3,4,5]');

-- ==========================================================================
-- CATEGORY J: Data Cleanup & Cascade (IDs 66-70)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(66, 66, 'functional', 'Deleting an Expert cascades to its memories',
 'Verify that deleting an Expert also removes all associated expert_memories rows.',
 '["Login and create an Expert","Add 3 manual memories to the Expert","Delete the Expert","Query expert_memories table directly for the deleted expert_id","Verify no memory rows remain for that expert_id","Verify no orphaned data in expert_behaviors table","Verify no orphaned data in expert_category_map table"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(67, 67, 'functional', 'Deleting a conversation cascades to messages and documents',
 'Verify that deleting a conversation removes all associated messages and documents.',
 '["Login, create a conversation, send 3 messages","Upload a document to the conversation","Delete the conversation","Query the messages table for the deleted conversation_id","Verify no messages remain","Query the documents table for the deleted conversation_id","Verify no documents remain","Verify the document file is cleaned up from the uploads directory"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(68, 68, 'functional', 'Deleting a user cascades to all their data',
 'Verify that deleting a user via admin panel removes their Experts, conversations, backends, and settings.',
 '["Login as admin, create a test user","Login as test user, create an Expert, a conversation, a backend, and settings","Login as admin, delete the test user via DELETE /api/admin/users/:id","Query experts table for the deleted user_id - verify empty","Query conversations table for the deleted user_id - verify empty","Query ai_backends table for the deleted user_id - verify empty","Query settings table for the deleted user_id - verify empty"]',
 0, 0, '[1,2,3,4,5,6,10,12]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(69, 69, 'functional', 'Deleting a backend removes it from Expert overrides',
 'Verify that deleting an AI backend nullifies backend_id references in Experts that used it as an override.',
 '["Login, create a backend and an Expert with backend_id set to that backend","Delete the backend","Verify the Expert backend_id or model_override is cleared or nullified","Verify the Expert still exists and is functional","Verify GET /api/experts/:id shows no backend override"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(70, 70, 'functional', 'Deleting a category removes Expert associations but not Experts',
 'Verify that deleting a category removes expert_category_map entries but the Experts themselves remain.',
 '["Login, create a category named TestCat","Create an Expert and assign it to TestCat","Delete the category via DELETE /api/categories/:id","Verify the Expert still exists in GET /api/experts","Verify expert_category_map has no rows for the deleted category_id","Verify GET /api/categories no longer includes TestCat"]',
 0, 0, '[1,2,3,4,5,6]');

-- ==========================================================================
-- CATEGORY K: Default & Reset (IDs 71-74)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(71, 71, 'functional', 'New user gets default dark theme',
 'Verify that a newly registered user starts with the dark theme applied and that the settings table reflects this default.',
 '["Register a new user","Login and navigate to the app","Verify the page uses dark theme colors (dark background)","Verify GET /api/settings returns theme=dark","Verify the Settings Appearance tab shows dark mode as selected"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(72, 72, 'functional', 'Expert personality defaults to formal',
 'Verify that creating an Expert without specifying personality_tone defaults to formal.',
 '["Login as a user","Create an Expert via POST /api/experts with only name and domain (no personality_tone)","Verify the response shows personality_tone=formal","Verify the database row has personality_tone=formal","Verify the Expert detail page shows formal as the personality"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(73, 73, 'functional', 'New conversation defaults to standard type',
 'Verify that creating a conversation without specifying a type defaults to standard.',
 '["Login and create a conversation via POST /api/conversations without specifying type","Verify the response shows type=standard","Verify the database row has type=standard","Verify expert_debate_enabled defaults to 0","Verify auto_suggest_experts defaults to 0"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(74, 74, 'functional', 'Expert memory_enabled defaults to true',
 'Verify that creating an Expert defaults memory_enabled to 1 (true) unless explicitly set otherwise.',
 '["Login and create an Expert without setting memory_enabled","Verify the response shows memory_enabled=1 or true","Verify the database row has memory_enabled=1","Create another Expert with memory_enabled=0","Verify that Expert has memory_enabled=0"]',
 0, 0, '[1,2,3,4,5,6]');

-- ==========================================================================
-- CATEGORY L: Search & Filter Edge Cases (IDs 75-78)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(75, 75, 'functional', 'Expert search with no results shows empty state',
 'Verify that searching for an Expert name that does not exist shows a meaningful empty state rather than a blank page.',
 '["Login and create 2 Experts","Navigate to Expert Library","Enter zzzznonexistent in the search field","Verify no Expert cards are shown","Verify an empty state message is displayed (e.g., No experts found)","Clear the search","Verify all Experts reappear"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(76, 76, 'functional', 'Conversation search matches message content',
 'Verify that searching conversations matches against message content, not just conversation titles.',
 '["Login and create 2 conversations","In conversation A send a message containing the word quantum","In conversation B send a message containing the word biology","Search conversations for quantum","Verify only conversation A appears in filtered results","Search for biology","Verify only conversation B appears","Search for zzzznothing","Verify empty results"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(77, 77, 'functional', 'Expert filter by category shows correct subset',
 'Verify that filtering Experts by a specific category chip shows only Experts assigned to that category.',
 '["Login and create categories: Law, Science","Create Expert A assigned to Law","Create Expert B assigned to Science","Create Expert C assigned to both Law and Science","Navigate to Expert Library","Click the Law filter chip","Verify only Expert A and C are shown","Click the Science filter chip","Verify only Expert B and C are shown","Clear filters","Verify all 3 Experts are shown"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(78, 78, 'functional', 'Expert search is case-insensitive',
 'Verify that searching for an Expert name works regardless of case.',
 '["Login and create an Expert named TaxAdvisor","Navigate to Expert Library","Search for taxadvisor (lowercase)","Verify TaxAdvisor appears","Search for TAXADVISOR (uppercase)","Verify TaxAdvisor appears","Search for TaXaDvIsOr (mixed case)","Verify TaxAdvisor appears"]',
 0, 0, '[1,2,3,4,5,6,7]');

-- ==========================================================================
-- CATEGORY M: Form Validation (IDs 79-83)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(79, 79, 'functional', 'Expert creation wizard validates required fields per step',
 'Verify that the Expert creation wizard prevents advancing past a step if required fields are empty.',
 '["Login and click New Expert","On Step 1 leave name blank and click Next","Verify a validation error appears for the name field","Enter a name but leave description blank (if required)","Verify appropriate validation behavior","On Step 2 leave domain blank and click Next","Verify validation error for domain","Fill in domain and advance through remaining steps","Verify the final Create button is only enabled when all required fields are populated"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(80, 80, 'functional', 'Registration form validates email format',
 'Verify that the registration form rejects invalid email formats before submitting to the API.',
 '["Navigate to /register","Enter notanemail in the email field","Enter valid username and password","Click Register","Verify validation error about invalid email format","Enter user@incomplete in the email field","Click Register","Verify validation error","Enter valid@email.com","Verify no email validation error"]',
 0, 0, '[1,2,3,4,5]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(81, 81, 'functional', 'Backend configuration validates required fields by type',
 'Verify that the Add Backend form requires the correct fields based on backend type selection.',
 '["Login and navigate to Settings > AI Backends","Click Add Backend","Select type=ollama","Verify base_url field is shown and required","Leave base_url empty and click Save","Verify validation error","Select type=openai","Verify api_key field is shown and required","Leave api_key empty and click Save","Verify validation error","Fill in required fields and save successfully"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(82, 82, 'functional', 'Change password form validates new password length',
 'Verify that the change password form on the Account settings tab validates minimum password length.',
 '["Login and navigate to Settings > Account tab","Enter current password correctly","Enter a new password of only 5 characters","Click Change Password","Verify validation error about minimum 8 characters","Enter a new password of exactly 8 characters","Click Change Password","Verify the password change succeeds"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(83, 83, 'functional', 'Expert import validates JSON file format',
 'Verify that POST /api/experts/import rejects files that are not valid Expert JSON format.',
 '["Login as a user","Send POST /api/experts/import with a plain text file","Verify response is 400 with error about invalid format","Send POST /api/experts/import with valid JSON but wrong schema (missing name)","Verify response is 400 with error about missing required fields","Send POST /api/experts/import with valid Expert JSON","Verify response is 201 and Expert is created"]',
 0, 0, '[1,2,3,4,5,6]');

-- ==========================================================================
-- CATEGORY N: Feedback & Notification (IDs 84-87)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(84, 84, 'functional', 'Success toast shown after creating an Expert',
 'Verify that a success notification/toast is displayed after successfully creating an Expert.',
 '["Login and complete the Expert creation wizard","Click Create Expert","Verify a success toast/notification appears with message like Expert created","Verify the toast auto-dismisses after a few seconds","Verify the user is navigated to the Expert Library or detail page"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(85, 85, 'functional', 'Error toast shown when API request fails',
 'Verify that when an API request fails, an error notification is shown to the user.',
 '["Login as a user","Attempt an action that will fail (e.g., delete a non-existent Expert by manipulating the request)","Verify an error toast appears with a descriptive message","Verify the error toast is visually distinct from success toasts (red/destructive color)","Verify the app does not crash or show a blank screen"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(86, 86, 'functional', 'Confirmation dialog shown before destructive actions',
 'Verify that delete operations for Experts, conversations, and users show a confirmation dialog before proceeding.',
 '["Login and create an Expert","Click Delete on the Expert","Verify a confirmation dialog appears asking Are you sure","Click Cancel on the dialog","Verify the Expert still exists","Click Delete again and confirm","Verify the Expert is deleted","Create a conversation and click Delete","Verify a confirmation dialog appears"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(87, 87, 'functional', 'Backend connection test shows live status indicator',
 'Verify that clicking Test Connection on a backend card shows a real-time status indicator (connected, failed, testing).',
 '["Login and add a backend","Navigate to Settings > AI Backends","Click Test Connection on the backend card","Verify a loading/testing indicator appears","Wait for the test to complete","Verify the status badge updates to connected or failed","Verify the status is visually clear (green for connected, red for failed)"]',
 0, 0, '[1,2,3,4,5,6,7]');

-- ==========================================================================
-- CATEGORY O: Responsive & Layout (IDs 88-90)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(88, 88, 'style', 'Two-column layout renders correctly at desktop width',
 'Verify that the main app layout has a fixed left sidebar (~260px) and flexible main content area at 1280px+ width.',
 '["Login as a user","Set viewport to 1280px wide","Verify left sidebar is visible with ~260px width","Verify main content area fills remaining space","Verify sidebar contains logo, navigation links, and user info","Verify main content area renders the active page","Verify no horizontal scrollbar appears","Verify sidebar and content do not overlap"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(89, 89, 'style', 'Expert library grid layout is visually organized',
 'Verify that Expert cards in the grid view are evenly distributed and visually organized at various screen widths.',
 '["Login and create 6+ Experts","Navigate to Expert Library in grid view","At 1440px width verify cards are arranged in a multi-column grid","Verify cards have consistent sizing and spacing","Verify domain chips and personality badges are visible on each card","At 1024px width verify grid adjusts (fewer columns)","At 768px width verify grid further adjusts to fewer columns","Verify no cards overflow or are clipped"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(90, 90, 'style', 'Crossfire side-by-side layout renders correctly',
 'Verify that Crossfire conversations display Expert responses side-by-side for 2 experts and in a grid for 3+.',
 '["Login and create a Crossfire conversation with 2 Experts","Submit a question","Verify responses appear in side-by-side panels","Verify each panel has Expert name header and model badge","Create another Crossfire with 3 Experts","Submit a question","Verify responses appear in a grid layout","Verify all panels are equally sized","Verify no panel content is hidden or clipped"]',
 0, 0, '[1,2,3,4,5,6,7]');

-- ==========================================================================
-- CATEGORY P: Accessibility (IDs 91-93)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(91, 91, 'style', 'Interactive elements are keyboard navigable',
 'Verify that buttons, links, inputs, and toggles can be navigated and activated via keyboard.',
 '["Login and navigate to Expert Library","Press Tab to move focus through the page elements","Verify focus moves to search input, sort dropdown, view toggle, New Expert button","Verify each focused element has a visible focus indicator","Press Enter on New Expert button","Verify the wizard opens","Use Tab and Enter to navigate through wizard steps","Verify all form fields are reachable via keyboard"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(92, 92, 'style', 'Form inputs have associated labels',
 'Verify that all form inputs (login, register, Expert wizard, settings) have proper labels or aria-labels for screen readers.',
 '["Navigate to /login","Verify email input has a label element or aria-label","Verify password input has a label element or aria-label","Navigate to /register","Verify all registration fields have labels","Login and navigate to Expert creation wizard","Verify each step input has a label or aria-label","Navigate to Settings","Verify settings form inputs have labels"]',
 0, 0, '[1,2,3,4,5]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(93, 93, 'style', 'Color contrast meets readability standards',
 'Verify that text on both dark and light themes has sufficient contrast against backgrounds for readability.',
 '["Login with dark theme active","Verify primary text (#f1f0ff) is clearly readable on dark background (#0f0f13)","Verify secondary text (#9b99b8) is readable on dark surface (#1a1a24)","Verify button text is readable on primary accent (#7c3aed)","Switch to light theme","Verify primary text (#1a1830) is readable on light background (#f8f7ff)","Verify interactive elements are distinguishable from static text","Verify error messages in destructive red (#ef4444) are readable"]',
 0, 0, '[1,2,3,4,5,6,7]');

-- ==========================================================================
-- CATEGORY Q: Temporal & Timezone (IDs 94-95)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(94, 94, 'functional', 'Message timestamps display correctly',
 'Verify that message timestamps in conversations display the correct time and are in a human-readable format.',
 '["Login and start a conversation","Send a message and note the current time","Verify the message timestamp shown in the UI matches the approximate current time","Wait a minute and send another message","Verify the second message has a later timestamp","Verify timestamps are formatted readably (e.g., 2:30 PM or relative like Just now)","Verify expert response messages also have timestamps"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(95, 95, 'functional', 'Expert last_used_at updates when a conversation is started',
 'Verify that starting or sending a message with an Expert updates the last_used_at field in the experts table.',
 '["Login and create an Expert","Verify last_used_at is null initially","Start a conversation with the Expert and send a message","Query the experts table directly","Verify last_used_at is now set to approximately the current time","Wait and send another message","Verify last_used_at is updated to the newer time"]',
 0, 0, '[1,2,3,4,5,6]');

-- ==========================================================================
-- CATEGORY R: Concurrency & Race Conditions (IDs 96-97)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(96, 96, 'functional', 'Concurrent Expert edits do not corrupt data',
 'Verify that two simultaneous PUT /api/experts/:id requests do not result in corrupted or mixed data.',
 '["Login and create an Expert","Send two concurrent PUT requests: one setting name=Alpha, one setting name=Beta","Verify the response from each request is valid (no 500 error)","Send GET /api/experts/:id","Verify the Expert has one consistent name (either Alpha or Beta, not mixed)","Verify no database corruption (all fields are intact)"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(97, 97, 'functional', 'Concurrent message sends are handled without loss',
 'Verify that sending multiple messages rapidly to a conversation does not result in lost or duplicated messages.',
 '["Login and create a conversation","Send 5 messages in rapid succession (no waiting between)","Wait for all responses","Verify all 5 user messages appear in the conversation","Verify GET /api/conversations/:id/messages returns all 5 user messages","Verify message order matches send order","Verify no duplicate messages exist"]',
 0, 0, '[1,2,3,4,5,6]');

-- ==========================================================================
-- CATEGORY S: Export/Import (IDs 98-100)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(98, 98, 'functional', 'Expert export produces valid downloadable JSON',
 'Verify that GET /api/experts/:id/export returns a downloadable JSON file containing all Expert configuration.',
 '["Login and create an Expert with name, domain, personality, behaviors, and system prompt","Send GET /api/experts/:id/export","Verify response has Content-Type application/json","Verify response has Content-Disposition header for file download","Parse the JSON response body","Verify it contains name, domain, personality_tone, description","Verify it contains behavior settings","Verify it contains the system prompt","Verify it does NOT contain sensitive data like user_id or database IDs"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(99, 99, 'functional', 'Expert import from exported JSON recreates the Expert',
 'Verify that importing a previously exported Expert JSON file creates a new Expert with all the same configuration.',
 '["Login and create an Expert with specific config (name=Original, domain=Law, personality=formal)","Export the Expert via GET /api/experts/:id/export","Save the JSON","Import the JSON via POST /api/experts/import","Verify response is 201 with new Expert data","Verify the imported Expert has a different ID from the original","Verify name, domain, personality_tone match the original","Verify behaviors match the original","Verify system_prompt matches the original","Verify GET /api/experts lists both the original and imported Expert"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(100, 100, 'functional', 'Crossfire conversation export produces formatted output',
 'Verify that exporting a Crossfire conversation produces a complete formatted text or JSON file with all Expert responses.',
 '["Login, create a Crossfire conversation with 2 Experts","Submit a question and get responses from both Experts","Export the Crossfire results","Verify the export contains the original question","Verify the export contains both Expert responses","Verify each response is attributed to the correct Expert","Verify the model used by each Expert is included","Verify the export is downloadable as a file"]',
 0, 0, '[1,2,3,4,5,6]');

-- ==========================================================================
-- CATEGORY T: Performance (IDs 101-105)
-- ==========================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(101, 101, 'functional', 'Health endpoint responds within 500ms',
 'Verify that GET /api/health responds quickly, indicating the server and database are performant.',
 '["Send GET /api/health and measure response time","Verify response time is under 500ms","Send 10 sequential requests to /api/health","Verify all respond within 500ms","Verify all responses return valid JSON with healthy status"]',
 0, 0, '[1,2,3,4,5]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(102, 102, 'functional', 'Expert list API responds under 1 second with 50 Experts',
 'Verify that GET /api/experts returns results within 1 second even when the user has 50 Experts.',
 '["Login as a user","Create 50 Experts via rapid API calls","Send GET /api/experts and measure response time","Verify response time is under 1000ms","Verify all 50 Experts are returned","Send GET /api/experts?search=test and measure response time","Verify filtered response is also under 1000ms"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(103, 103, 'functional', 'App loads without console errors',
 'Verify that the frontend application loads fully without any JavaScript console errors.',
 '["Open browser developer tools console","Navigate to /login","Verify no console errors appear","Login as a user","Verify no console errors during login","Navigate to Expert Library","Verify no console errors","Navigate to Conversations","Verify no console errors","Navigate to Settings","Verify no console errors","Check that all pages rendered properly without error boundaries triggering"]',
 0, 0, '[1,2,3,4,5,6,7]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(104, 104, 'functional', 'SSE streaming delivers tokens progressively',
 'Verify that AI responses are delivered via Server-Sent Events progressively rather than as a single block.',
 '["Login and create an Expert with a configured backend","Start a conversation and send a message","Monitor the EventSource/SSE connection","Verify the response arrives as multiple SSE data events over time","Verify partial content is displayed in the UI as it streams","Verify the streaming indicator is shown during delivery","Verify the final message is complete when streaming ends","Verify the connection is properly closed after the response completes"]',
 0, 0, '[1,2,3,4,5,6]');

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies) VALUES
(105, 105, 'functional', 'Copy message to clipboard works correctly',
 'Verify that clicking the copy button on a chat message copies the message content to the clipboard.',
 '["Login and start a conversation with an Expert","Send a message and receive a response","Locate the copy button on the Expert response message","Click the copy button","Verify a success indicator appears (e.g., checkmark or Copied! tooltip)","Paste from clipboard into another input field","Verify the pasted content matches the message text","Verify the copy button works on user messages as well"]',
 0, 0, '[1,2,3,4,5,6,7]');
