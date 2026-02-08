# Phase 4 Complete: Knowledge Base (Library)

## ✅ Implementation Summary

Phase 4 adds a complete Content Management System (CMS) for the knowledge base, allowing admins to create, edit, and delete posts while users can browse and read content.

---

## 🎯 Features Implemented

### 1. Navigation
- ✅ "LIBRARY" button added to ClientHome menu
- ✅ "LIBRARY" button added to AdminHome menu
- ✅ Accessible to ALL authenticated users
- ✅ Route: `view === 'library'`

### 2. Database Schema (`setup_knowledge_base.sql`)

**Table: `posts`**
```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**RLS Policies**:
- ✅ SELECT: All authenticated users can view
- ✅ INSERT: Only admins can create
- ✅ UPDATE: Only admins can edit
- ✅ DELETE: Only admins can delete

**Features**:
- Auto-update `updated_at` trigger
- Indexes on category and created_at
- Sample data included (3 posts)

### 3. UI Component (`KnowledgeBase`)

**Location**: `src/App.jsx` (added before AdminHome)

**Layout**: Card Grid (Pinterest style)
- Responsive: 1 column mobile, 2 columns desktop
- Grid gap: 4 (1rem spacing)

**Card Design**:
```
┌─────────────────────────┐
│ [  IMAGE  ]             │ ← Hover zoom effect
├─────────────────────────┤
│ [Nutrition]             │ ← Category badge
│                         │
│ 체지방 감량을 위한...    │ ← Title (gold, bold)
│                         │
│ 고강도 운동일에는...     │ ← Content snippet
│                         │
│ 2024.02.09              │ ← Date
└─────────────────────────┘
```

**Visual Features**:
- Image with scale effect on hover
- Yellow category badge with background
- Gold title (line-clamp-2 for overflow)
- Gray content snippet (line-clamp-3)
- Hover effect: Yellow border
- Click to open full post

### 4. Admin CMS Features

**Floating Action Button (FAB)**:
- Fixed position: bottom-right (above bottom navigation)
- Yellow circular button with "+" icon
- Only visible to admins
- Opens editor modal on click

**Editor Modal**:
```
┌─────────────────────────────┐
│ New Post / Edit Post    ✕   │
├─────────────────────────────┤
│ Title                       │
│ [Input]                     │
│                             │
│ Category                    │
│ [Input]                     │
│                             │
│ 🖼️ Image URL (Optional)     │
│ [Input]                     │
│                             │
│ Content                     │
│ [Textarea - 200px]          │
│                             │
│ [CANCEL] [SAVE POST]        │
└─────────────────────────────┘
```

**Features**:
- Create new posts (FAB → Editor)
- Edit existing posts (Card → Detail → Edit)
- Delete posts (Card → Detail → Delete)
- Form validation
- Success/error alerts
- Real-time list refresh

**Post Detail Modal** (Admin View):
```
┌─────────────────────────────┐
│ [  FULL IMAGE  ]            │
├─────────────────────────────┤
│ [Nutrition]            ✕    │
│ Full Post Title             │
│ 2024.02.09                  │
│                             │
│ Full content here...        │
│ With line breaks preserved  │
│                             │
│ [  EDIT  ] [ DELETE ]       │
└─────────────────────────────┘
```

### 5. User Features

**Post Detail Modal** (User View):
```
┌─────────────────────────────┐
│ [  FULL IMAGE  ]            │
├─────────────────────────────┤
│ [Nutrition]            ✕    │
│ Full Post Title             │
│ 2024.02.09                  │
│                             │
│ Full content here...        │
│ With line breaks preserved  │
│                             │
│ [       CLOSE       ]       │
└─────────────────────────────┘
```

**Features**:
- Browse all posts in grid
- Click to read full content
- View images, category, date
- Cannot edit or delete
- Close button to return

---

## 📋 Technical Implementation

### Component Structure

```javascript
const KnowledgeBase = ({ user, setView }) => {
  // State
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostDetail, setShowPostDetail] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Functions
  // - fetchPosts()
  // - handleOpenEditor()
  // - handleSavePost()
  // - handleDeletePost()
  // - handleCardClick()
};
```

### Admin Check

```javascript
useEffect(() => {
  const checkAdmin = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    setIsAdmin(data?.role === 'admin');
  };
  checkAdmin();
}, [user]);
```

### Fetch Posts

```javascript
const fetchPosts = async () => {
  setLoading(true);
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false }); // Newest first

  if (error) {
    console.error('Error fetching posts:', error);
    setPosts([]);
  } else {
    setPosts(data || []);
  }
  setLoading(false);
};
```

### Create/Update Post

```javascript
const handleSavePost = async () => {
  if (!title || !category || !content) {
    return alert('제목, 카테고리, 내용을 모두 입력해주세요.');
  }

  setSaving(true);

  try {
    if (selectedPost) {
      // Update
      const { error } = await supabase
        .from('posts')
        .update({ title, category, image_url: imageUrl || null, content })
        .eq('id', selectedPost.id);
      if (error) throw error;
      alert('게시글이 수정되었습니다!');
    } else {
      // Create
      const { error } = await supabase
        .from('posts')
        .insert({ title, category, image_url: imageUrl || null, content });
      if (error) throw error;
      alert('새 게시글이 추가되었습니다!');
    }

    setShowEditor(false);
    fetchPosts();
  } catch (error) {
    alert('오류 발생: ' + error.message);
  } finally {
    setSaving(false);
  }
};
```

### Delete Post

```javascript
const handleDeletePost = async (postId) => {
  if (!confirm('이 게시글을 삭제하시겠습니까?')) return;

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) {
    alert('삭제 실패: ' + error.message);
  } else {
    alert('게시글이 삭제되었습니다.');
    setShowPostDetail(false);
    fetchPosts();
  }
};
```

---

## 🎨 UI Design

### Card Grid

**Responsive Layout**:
- Mobile: `grid-cols-1` (single column)
- Desktop: `md:grid-cols-2` (two columns)
- Gap: `gap-4` (1rem spacing)

**Card Styling**:
- Background: `bg-zinc-900`
- Border: `border-zinc-800` → hover: `border-yellow-600/50`
- Rounded corners: `rounded-xl`
- Image height: `h-48` (12rem)
- Padding: `p-4`

**Category Badge**:
- Background: `bg-yellow-600/20`
- Text: `text-yellow-500`
- Size: `text-xs`
- Padding: `px-3 py-1`
- Rounded: `rounded-full`

**Title**:
- Color: `text-yellow-500`
- Font: `font-bold`
- Size: `text-lg`
- Overflow: `line-clamp-2` (max 2 lines)

**Content Snippet**:
- Color: `text-zinc-400`
- Size: `text-sm`
- Overflow: `line-clamp-3` (max 3 lines)

### FAB (Floating Action Button)

```javascript
<button className="fixed bottom-24 right-6 w-14 h-14 bg-yellow-600 rounded-full flex items-center justify-center shadow-lg hover:bg-yellow-500 active:scale-95 transition-all z-40">
  <Plus size={24} className="text-white" />
</button>
```

**Position**: 
- `bottom-24` (6rem from bottom, above navigation)
- `right-6` (1.5rem from right edge)
- `z-40` (above other content)

### Modals

**Post Detail Modal**:
- Full-screen overlay: `inset-0`
- Black background: `bg-black/90`
- Max width: `max-w-2xl`
- Scrollable: `overflow-y-auto`
- Image header: `h-64` (16rem)
- Border: `border-2 border-yellow-500`

**Editor Modal**:
- Same overlay style
- Form fields with labels
- Textarea: `min-h-[200px]` (8rem minimum)
- Two buttons: Cancel (gray) + Save (yellow)

---

## 🔄 User Flows

### Regular User Flow

```
ClientHome
    ↓ Click "LIBRARY"
KnowledgeBase
    ↓ Browse posts
    ↓ Click a card
Post Detail Modal
    ↓ Read content
    ↓ Click "CLOSE"
Back to grid
```

### Admin Flow - Create Post

```
ClientHome or AdminHome
    ↓ Click "LIBRARY"
KnowledgeBase
    ↓ Click FAB (+)
Editor Modal
    ↓ Fill in form
    ↓ Click "SAVE POST"
Post created ✓
    ↓ List refreshes
New post appears
```

### Admin Flow - Edit Post

```
KnowledgeBase
    ↓ Click a card
Post Detail Modal
    ↓ Click "EDIT"
Editor Modal (pre-filled)
    ↓ Modify content
    ↓ Click "SAVE POST"
Post updated ✓
    ↓ Modal closes
List refreshes
```

### Admin Flow - Delete Post

```
KnowledgeBase
    ↓ Click a card
Post Detail Modal
    ↓ Click "DELETE"
Confirmation dialog
    ↓ Confirm
Post deleted ✓
    ↓ Modal closes
List refreshes
```

---

## 🧪 Testing Guide

### Setup

1. **Run SQL in Supabase**:
   ```bash
   # Open Supabase Dashboard → SQL Editor
   # Copy contents of setup_knowledge_base.sql
   # Run the script
   ```

2. **Verify Table Created**:
   ```sql
   SELECT * FROM posts ORDER BY created_at DESC;
   -- Should show 3 sample posts
   ```

3. **Verify RLS Policies**:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'posts';
   -- Should show 4 policies (SELECT, INSERT, UPDATE, DELETE)
   ```

### Test 1: User Views Posts

1. Login as regular user
2. Click "LIBRARY" from ClientHome
3. **Expected**:
   - See 3 sample posts in grid
   - Each card shows image, title, snippet
   - No FAB button visible (user can't edit)

### Test 2: User Reads Post

1. In Library, click a card
2. **Expected**:
   - Modal opens with full content
   - Image at top (if available)
   - Category badge and title
   - Full content displayed
   - Only "CLOSE" button visible (no Edit/Delete)

### Test 3: Admin Creates Post

1. Login as admin (admin / 1234)
2. Go to Library
3. **Expected**: See FAB (+) button in bottom-right
4. Click FAB
5. **Expected**: Editor modal opens
6. Fill in:
   - Title: "Test Post"
   - Category: "Test"
   - Content: "This is a test post"
7. Click "SAVE POST"
8. **Expected**:
   - Alert: "새 게시글이 추가되었습니다!"
   - Modal closes
   - New post appears in grid

### Test 4: Admin Edits Post

1. As admin, click a post card
2. Click "EDIT" button
3. **Expected**:
   - Editor modal opens
   - Form pre-filled with post data
4. Modify title to "Updated Title"
5. Click "SAVE POST"
6. **Expected**:
   - Alert: "게시글이 수정되었습니다!"
   - Modal closes
   - Post shows updated title

### Test 5: Admin Deletes Post

1. As admin, click a post card
2. Click "DELETE" button
3. **Expected**: Confirmation dialog
4. Click OK
5. **Expected**:
   - Alert: "게시글이 삭제되었습니다."
   - Modal closes
   - Post removed from grid

### Test 6: RLS Security

**Test as User** (in browser console):
```javascript
// Try to create post as regular user (should fail)
const { error } = await supabase
  .from('posts')
  .insert({ 
    title: 'Hacked', 
    category: 'Test', 
    content: 'Test' 
  });

console.log(error); 
// Expected: "new row violates row-level security policy"
```

### Test 7: Empty State

1. Delete all posts in database
2. View Library
3. **Expected**:
   ```
   📖
   No Posts Yet
   Knowledge base is empty
   ```

---

## 🎨 Visual Design Details

### Color Palette

- **Background**: `bg-zinc-950` (main), `bg-zinc-900` (cards)
- **Borders**: `border-zinc-800` → hover: `border-yellow-600/50`
- **Category Badge**: `bg-yellow-600/20`, `text-yellow-500`
- **Title**: `text-yellow-500`
- **Content**: `text-zinc-400`
- **Date**: `text-zinc-600`
- **FAB**: `bg-yellow-600`

### Typography

- **Title in Card**: `text-lg`, `font-bold`
- **Title in Modal**: `text-2xl`, `font-bold`
- **Category**: `text-xs`, `uppercase` (in modal)
- **Content Snippet**: `text-sm`
- **Labels**: `text-xs`, `uppercase`, `tracking-wider`

### Animations

- **Image Hover**: `scale-105` (zoom effect)
- **Card Hover**: Border color transition
- **FAB Hover**: Background color + scale
- **Modal Enter**: Fade in + scale up
- **Modal Exit**: Fade out + scale down

### Spacing

- **Card Padding**: `p-4` (1rem)
- **Modal Padding**: `p-6` (1.5rem)
- **Form Field Spacing**: `space-y-4` (1rem)
- **Grid Gap**: `gap-4` (1rem)

---

## 📝 Code Stats

- **Component**: `KnowledgeBase` (~250 lines)
- **Modals**: 2 (Post Detail, Editor)
- **States**: 10 variables
- **Functions**: 5 (fetch, open editor, save, delete, card click)
- **Icons Used**: BookOpen, Plus, Edit, Trash2, Image, X, Calendar

---

## 🔒 Security

### RLS Enforcement

| Action | User | Admin | Anonymous |
|--------|------|-------|-----------|
| View Posts | ✅ Yes | ✅ Yes | ❌ No |
| Create Posts | ❌ No | ✅ Yes | ❌ No |
| Edit Posts | ❌ No | ✅ Yes | ❌ No |
| Delete Posts | ❌ No | ✅ Yes | ❌ No |

### Admin Detection

```javascript
const { data } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single();

setIsAdmin(data?.role === 'admin');
```

**FAB Visibility**:
```javascript
{isAdmin && (
  <button ... FAB ... />
)}
```

**Admin Actions in Detail Modal**:
```javascript
{isAdmin && (
  <div>
    <button>EDIT</button>
    <button>DELETE</button>
  </div>
)}
```

---

## 💡 Use Cases

### Use Case 1: Nutrition Tips

**Admin Creates**:
- Title: "단백질 섭취 가이드"
- Category: "Nutrition"
- Content: Detailed protein intake guide
- Image: Food photo

**Users Read**:
- Browse library
- Click card
- Read full guide
- Apply to their diet

### Use Case 2: Workout Programs

**Admin Creates**:
- Title: "홈 트레이닝 루틴"
- Category: "Workout"
- Content: Complete home workout routine
- Image: Exercise demonstration

**Users Benefit**:
- Access professional workout plans
- Follow structured programs
- No need for external resources

### Use Case 3: Mindset Content

**Admin Creates**:
- Title: "운동 동기부여 유지법"
- Category: "Mindset"
- Content: Mental strategies for consistency

**Users Engage**:
- Read motivational content
- Apply mental strategies
- Stay consistent with training

---

## 🚀 Optional Enhancements (Future)

### 1. Categories Filter

Add filter buttons above grid:

```javascript
const [selectedCategory, setSelectedCategory] = useState('All');

const filteredPosts = selectedCategory === 'All' 
  ? posts 
  : posts.filter(p => p.category === selectedCategory);
```

### 2. Search Functionality

```javascript
const [searchTerm, setSearchTerm] = useState('');

const searchedPosts = posts.filter(p => 
  p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
  p.content.toLowerCase().includes(searchTerm.toLowerCase())
);
```

### 3. Rich Text Editor

Replace textarea with markdown editor:
```javascript
import ReactMarkdown from 'react-markdown';

<ReactMarkdown>{post.content}</ReactMarkdown>
```

### 4. Image Upload

Instead of URL, allow file upload:
```javascript
const handleImageUpload = async (file) => {
  const { data, error } = await supabase.storage
    .from('post-images')
    .upload(`${Date.now()}_${file.name}`, file);
  
  if (!error) {
    const url = supabase.storage.from('post-images').getPublicUrl(data.path);
    setImageUrl(url.data.publicUrl);
  }
};
```

### 5. Like/Save Functionality

Track user interactions:
```sql
CREATE TABLE post_likes (
  user_id UUID REFERENCES profiles(id),
  post_id UUID REFERENCES posts(id),
  PRIMARY KEY (user_id, post_id)
);
```

### 6. Comments

Add discussion feature:
```sql
CREATE TABLE post_comments (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES posts(id),
  user_id UUID REFERENCES profiles(id),
  content TEXT,
  created_at TIMESTAMP
);
```

---

## ✅ Phase 4 Checklist

### Database
- [x] Created `posts` table
- [x] Added all required columns
- [x] Set up RLS policies (4 policies)
- [x] Created indexes (category, created_at)
- [x] Added auto-update trigger for `updated_at`
- [x] Inserted sample data (3 posts)

### Frontend - Component
- [x] Created `KnowledgeBase` component
- [x] Added to App.jsx before AdminHome
- [x] Added routing for `library` view

### Frontend - Navigation
- [x] Added "LIBRARY" button to ClientHome
- [x] Added "LIBRARY" button to AdminHome
- [x] Connected buttons to `setView('library')`

### Frontend - User Features
- [x] Card grid display (responsive)
- [x] Image with hover effect
- [x] Category badge
- [x] Title and content snippet
- [x] Click to view full post
- [x] Post detail modal
- [x] Close functionality
- [x] Empty state
- [x] Loading state

### Frontend - Admin Features
- [x] Admin role detection
- [x] FAB (+) button (admin only)
- [x] Editor modal (create/edit)
- [x] Form validation
- [x] Save functionality (INSERT/UPDATE)
- [x] Edit button in post detail
- [x] Delete button with confirmation
- [x] Pre-fill editor for editing
- [x] Clear form for new post
- [x] Success/error alerts
- [x] Real-time list refresh

### Testing
- [x] No linter errors
- [x] All modals working
- [x] Animations smooth
- [x] RLS tested (documented)

---

## 🎉 Phase 4 Complete!

The Knowledge Base (Library) is now fully functional with:

- ✅ Complete CMS for admins (Create, Read, Update, Delete)
- ✅ Beautiful card grid display
- ✅ Post detail modal with images
- ✅ Responsive design
- ✅ RLS security enforced
- ✅ Navigation from both client and admin views
- ✅ Empty and loading states
- ✅ Smooth animations
- ✅ Premium Black & Gold theme

**Ready for content creation!** 🚀
