# 📚 Quick Reference: Knowledge Base (Library)

## Setup (One-Time)

### 1. Run SQL Script
```bash
# In Supabase Dashboard → SQL Editor
# Copy contents of setup_knowledge_base.sql
# Click "Run"
```

### 2. Verify
```sql
SELECT * FROM posts;
-- Should show 3 sample posts
```

---

## Access

### For Users
```
ClientHome → [LIBRARY] → Browse Posts → Click Card → Read
```

### For Admins
```
AdminHome → [LIBRARY] → See FAB (+) → Create/Edit/Delete Posts
```

---

## Features

### Users Can:
- ✅ Browse all posts in card grid
- ✅ Click to view full content
- ✅ See images, categories, dates
- ❌ Cannot create, edit, or delete

### Admins Can:
- ✅ Everything users can do, PLUS:
- ✅ Create new posts (FAB button)
- ✅ Edit existing posts
- ✅ Delete posts
- ✅ Manage content via modals

---

## UI Components

### Card Grid
```
┌───────┬───────┐
│ Card  │ Card  │
├───────┼───────┤
│ Card  │ Card  │
└───────┴───────┘
```
- Responsive (1 col mobile, 2 cols desktop)
- Hover effects
- Category badges
- Content snippets

### FAB (Admin Only)
```
                    [+]
```
- Yellow circular button
- Bottom-right corner
- Fixed position

### Modals
- Post Detail (read full content)
- Editor (create/edit posts)
- Smooth animations
- Click outside to close

---

## Admin Workflow

### Create Post
1. Click FAB (+)
2. Fill form:
   - Title
   - Category
   - Image URL (optional)
   - Content
3. Click "SAVE POST"
4. Done! ✓

### Edit Post
1. Click card
2. Click "EDIT"
3. Modify fields
4. Click "SAVE POST"
5. Done! ✓

### Delete Post
1. Click card
2. Click "DELETE"
3. Confirm
4. Done! ✓

---

## Database Schema

```sql
posts
├── id (UUID)
├── title (TEXT)
├── content (TEXT)
├── category (TEXT)
├── image_url (TEXT, nullable)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP, auto)
```

---

## RLS Policies

| Action | User | Admin |
|--------|------|-------|
| SELECT | ✅ | ✅ |
| INSERT | ❌ | ✅ |
| UPDATE | ❌ | ✅ |
| DELETE | ❌ | ✅ |

---

## Sample Categories

- Nutrition
- Workout
- Mindset
- Recovery
- Technique
- Programming

---

## Common Issues

### Issue: FAB not showing

**Check**: Are you logged in as admin?

```sql
SELECT role FROM profiles WHERE id = 'YOUR_USER_ID';
-- Should be 'admin'
```

### Issue: Can't create post

**Check**: RLS policies exist?

```sql
SELECT * FROM pg_policies WHERE tablename = 'posts';
```

### Issue: Images not loading

**Check**: Is URL valid?
- Must be full URL with https://
- Must be publicly accessible
- Test in browser first

---

## Quick Test

### 1. View Posts
```
Login → LIBRARY → See posts ✓
```

### 2. Read Post
```
Click card → Modal opens → Read content ✓
```

### 3. Admin Create (if admin)
```
FAB → Fill form → SAVE → New post ✓
```

---

## Files

- `setup_knowledge_base.sql` - Database schema
- `PHASE_4_COMPLETE.md` - Full documentation
- `src/App.jsx` - KnowledgeBase component

---

## Next Steps

After setup:
1. ✅ Test as user (browse, read)
2. ✅ Test as admin (create, edit, delete)
3. ✅ Add real content
4. 🎨 Customize categories
5. 📸 Add quality images

---

## 🎉 Phase 4 Complete!

Knowledge Base is production-ready with full CMS capabilities!
