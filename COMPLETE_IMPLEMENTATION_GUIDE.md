# Complete Implementation Guide

## STEP 1: Install Required Package

Run in your terminal:
```bash
npm install html5-qrcode
```

## STEP 2: Update Imports (Top of App.jsx)

Add to line 3:
```javascript
import { Html5QrcodeScanner } from 'html5-qrcode';
```

## STEP 3: Add Back Button Component (After ButtonGhost)

Add this new component around line 80:
```javascript
const BackButton = ({ onClick, label = "Back" }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 text-zinc-400 hover:text-yellow-500 transition-colors mb-4"
  >
    <ArrowLeft size={20} />
    <span className="text-sm uppercase tracking-wider">{label}</span>
  </button>
);
```

## STEP 4: Update LoginView - Add Forgot Password

Find the LoginView component (around line 84) and update it:

```javascript
const LoginView = ({ setView }) => {
    const [email, setEmail] = useState('');
    const [pw, setPw] = useState('');
    const [loading, setLoading] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetSent, setResetSent] = useState(false);

    const handleForgotPassword = async () => {
        if (!resetEmail) {
            alert('Please enter your email address');
            return;
        }
        
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            
            if (error) throw error;
            
            setResetSent(true);
            alert('Password reset link sent to your email!');
            setTimeout(() => {
                setShowForgotPassword(false);
                setResetSent(false);
                setResetEmail('');
            }, 3000);
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleLogin = async () => {
        if (email === 'admin' && pw === '1234') {
            alert('관리자 모드로 진입합니다.');
            setView('admin_home');
            return;
        }

        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: pw,
        });

        if (error) {
            alert('Login failed: ' + error.message);
        } else if (data.user) {
            alert('Login successful!');
        }
        setLoading(false);
    };

    return (
      <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-serif text-yellow-500 mb-2 text-center tracking-wider">THE COACH</h1>
          <p className="text-zinc-600 text-center mb-8 text-xs tracking-widest uppercase">Professional PT Management</p>

          {!showForgotPassword ? (
            <>
              <div className="space-y-4 mb-6">
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:border-yellow-600 outline-none transition-colors"
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={pw} 
                  onChange={e => setPw(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:border-yellow-600 outline-none transition-colors"
                />
              </div>

              <ButtonPrimary onClick={handleLogin} disabled={loading}>
                {loading ? 'Logging in...' : 'LOGIN'}
              </ButtonPrimary>

              <button
                onClick={() => setShowForgotPassword(true)}
                className="w-full text-center text-sm text-zinc-500 hover:text-yellow-500 transition-colors mt-4"
              >
                Forgot Password?
              </button>

              <div className="mt-6 pt-6 border-t border-zinc-900">
                <ButtonGhost onClick={() => setView('register')}>
                  CREATE NEW ACCOUNT
                </ButtonGhost>
              </div>
            </>
          ) : (
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
              <h3 className="text-xl font-bold text-yellow-500 mb-4">Reset Password</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              
              <input 
                type="email" 
                placeholder="Enter your email" 
                value={resetEmail} 
                onChange={e => setResetEmail(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:border-yellow-600 outline-none transition-colors mb-4"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleForgotPassword}
                  className="flex-1 py-3 px-4 bg-yellow-600 hover:bg-yellow-500 rounded-xl text-black font-bold transition-all"
                >
                  Send Reset Link
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
};
```

## STEP 5: Update RegisterView - Remove Goal Field

Update `/Users/woogie/Desktop/the coach/src/pages/RegisterView.jsx`:

Find and remove the Goal input field. Keep only:
- Name
- Email
- Password
- Confirm Password

## STEP 6: Update QRScanner with Real Camera

Replace the QRScanner component with:

```javascript
const QRScanner = ({ setView }) => {
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const scannerRef = useRef(null);

    useEffect(() => {
        if (scanning && !scannerRef.current) {
            const scanner = new Html5QrcodeScanner(
                "qr-reader",
                { 
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                },
                false
            );

            scanner.render(onScanSuccess, onScanError);
            scannerRef.current = scanner;
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
                scannerRef.current = null;
            }
        };
    }, [scanning]);

    const onScanSuccess = async (decodedText, decodedResult) => {
        console.log(`QR Code detected: ${decodedText}`);
        setResult(decodedText);
        
        // Assume QR contains user UUID
        try {
            const { data, error } = await supabase.rpc('check_in_user', {
                user_uuid: decodedText
            });

            if (error) throw error;

            alert(`Check-in successful! Remaining sessions: ${data.remaining}`);
            
            // Stop scanner
            if (scannerRef.current) {
                scannerRef.current.clear();
                scannerRef.current = null;
            }
            setScanning(false);
            setResult(null);
        } catch (err) {
            setError(err.message);
            alert('Check-in failed: ' + err.message);
        }
    };

    const onScanError = (errorMessage) => {
        // Ignore scan errors (they happen continuously while scanning)
    };

    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-white p-6 pb-20">
        <BackButton onClick={() => setView('admin_home')} />
        
        <header className="mb-8">
          <h2 className="text-2xl font-bold text-yellow-500 mb-2">QR Scanner</h2>
          <p className="text-zinc-400 text-sm">Scan member QR codes to log attendance</p>
        </header>

        {!scanning ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Camera size={80} className="text-yellow-500 mb-6" />
            <button
              onClick={() => setScanning(true)}
              className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-4 px-8 rounded-xl transition-all shadow-lg"
            >
              Start Camera
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div id="qr-reader" className="rounded-xl overflow-hidden border-2 border-yellow-500"></div>
            
            <button
              onClick={() => {
                if (scannerRef.current) {
                  scannerRef.current.clear();
                  scannerRef.current = null;
                }
                setScanning(false);
                setResult(null);
                setError(null);
              }}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-6 rounded-xl transition-all"
            >
              Stop Scanner
            </button>

            {result && (
              <div className="bg-green-900/20 border border-green-500 rounded-xl p-4">
                <p className="text-green-400 font-bold">✓ Scanned: {result}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-500 rounded-xl p-4">
                <p className="text-red-400">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
};
```

## STEP 7: Update Library Component with Categories & Search

Replace the Library section with:

```javascript
// Inside the library view rendering (around line 622)
{(session || view === 'admin_home' || view === 'library') && view === 'library' && (
  <div className="min-h-[100dvh] bg-zinc-950 flex flex-col p-6 text-white overflow-y-auto pb-24">
    <BackButton onClick={() => setView(session ? 'client_home' : 'admin_home')} />
    
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-2xl font-bold text-yellow-500">📚 KNOWLEDGE BASE</h2>
      {(session?.user?.email === 'admin' || !session) && (
        <button 
          onClick={() => setShowWriteModal(true)}
          className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold hover:bg-yellow-400 transition shadow-lg"
        >
          + NEW POST
        </button>
      )}
    </div>

    {/* Search Bar */}
    <div className="flex gap-2 mb-4">
      <input
        type="text"
        placeholder="Search knowledge base..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:border-yellow-500 outline-none transition-colors"
      />
      <button
        onClick={handleSearch}
        className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2"
      >
        <Search size={18} />
        Search
      </button>
    </div>

    {/* Category Tabs */}
    <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
      {['All', 'Exercise', 'Diet', 'Routine', 'Tip', 'Notice'].map(cat => (
        <button
          key={cat}
          onClick={() => setSelectedCategory(cat)}
          className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
            selectedCategory === cat
              ? 'bg-yellow-600 text-black'
              : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>

    {isLibraryLoading ? (
      <div className="text-center text-zinc-400 mt-10">Loading library...</div>
    ) : filteredPosts.length === 0 ? (
      <div className="text-center text-zinc-500 mt-10 p-8 border border-zinc-800 rounded-xl">
        <p className="text-xl">No posts found</p>
      </div>
    ) : (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredPosts.map((post) => (
          <div
            key={post.id}
            onClick={() => {
              setSelectedPost(post);
              setShowPostDetail(true);
            }}
            className="bg-zinc-900 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-yellow-500 transition-all"
          >
            {post.image_url ? (
              <img src={post.image_url} alt={post.title} className="w-full h-40 object-cover" />
            ) : (
              <div className="w-full h-40 bg-zinc-800 flex items-center justify-center">
                <BookOpen size={40} className="text-zinc-600" />
              </div>
            )}
            <div className="p-3">
              <h3 className="font-bold text-sm line-clamp-2 text-white">{post.title}</h3>
            </div>
          </div>
        ))}
      </div>
    )}

    {/* Post Detail Modal - Keep existing modal code but ensure it's full-screen */}
    {showPostDetail && selectedPost && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm overflow-y-auto"
        onClick={() => setShowPostDetail(false)}
      >
        <div className="min-h-screen p-6 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-zinc-900 border-2 border-yellow-500 rounded-2xl max-w-3xl w-full"
            onClick={e => e.stopPropagation()}
          >
            {selectedPost.image_url && (
              <img 
                src={selectedPost.image_url} 
                alt={selectedPost.title}
                className="w-full h-64 object-cover rounded-t-2xl"
              />
            )}
            
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  {selectedPost.category && (
                    <span className="inline-block text-xs bg-yellow-600/20 text-yellow-500 px-3 py-1 rounded-full mb-2 border border-yellow-500/20">
                      {selectedPost.category}
                    </span>
                  )}
                  <h2 className="text-2xl font-bold text-yellow-500 mb-2">
                    {selectedPost.title || 'Untitled'}
                  </h2>
                  {selectedPost.created_at && (
                    <p className="text-xs text-zinc-500">
                      {new Date(selectedPost.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  )}
                </div>
                <button 
                  onClick={() => setShowPostDetail(false)}
                  className="text-zinc-500 hover:text-white transition-colors p-2"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="prose prose-invert max-w-none">
                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {selectedPost.content || 'No content'}
                </p>
              </div>

              {(session?.user?.email === 'admin' || !session) && (
                <div className="flex gap-2 pt-6 mt-6 border-t border-zinc-800">
                  <button
                    onClick={() => {
                      setShowPostDetail(false);
                      // Add edit functionality
                    }}
                    className="flex-1 bg-yellow-600/20 border border-yellow-600/30 text-yellow-500 font-bold py-3 rounded-xl hover:bg-yellow-600/30 transition-all"
                  >
                    EDIT
                  </button>
                  <button
                    onClick={() => {
                      // Add delete functionality
                    }}
                    className="flex-1 bg-red-600/20 border border-red-600/30 text-red-500 font-bold py-3 rounded-xl hover:bg-red-600/30 transition-all"
                  >
                    DELETE
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    )}

    {/* Keep existing Write Modal */}
  </div>
)}
```

## STEP 8: Add Required State Variables

In the App component state section (around line 426), add:

```javascript
// [Library Enhanced State]
const [selectedCategory, setSelectedCategory] = useState('All');
const [searchQuery, setSearchQuery] = useState('');
const [filteredPosts, setFilteredPosts] = useState([]);
const [selectedPost, setSelectedPost] = useState(null);
const [showPostDetail, setShowPostDetail] = useState(false);
```

## STEP 9: Add Search and Filter Logic

After the `fetchLibraryPosts` function, add:

```javascript
const handleSearch = () => {
  let filtered = libraryPosts;

  // Filter by category
  if (selectedCategory !== 'All') {
    filtered = filtered.filter(post => post.category === selectedCategory);
  }

  // Filter by search query (only when button clicked)
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(post =>
      post.title.toLowerCase().includes(query) ||
      (post.content && post.content.toLowerCase().includes(query))
    );
  }

  setFilteredPosts(filtered);
};

// Update filtered posts when category changes or posts load
useEffect(() => {
  handleSearch();
}, [selectedCategory, libraryPosts]);
```

## STEP 10: Add Back Buttons to All Views

Add `<BackButton onClick={() => setView('...')} />` at the top of:
- MemberList
- MemberDetail  
- AdminSchedule
- Revenue view
- ClassBooking

Example for MemberList (around line 1448):

```javascript
return (
  <div className="min-h-[100dvh] bg-zinc-950 text-white p-6">
    <BackButton onClick={() => setView('admin_home')} />
    
    <header className="flex items-center justify-between mb-8">
      {/* existing header */}
    </header>
    {/* rest of component */}
  </div>
);
```

---

## Summary

After implementing all these changes:

✅ Back buttons on all sub-views
✅ Real QR camera scanning
✅ Library with categories and search
✅ Search button (not auto-search)
✅ Forgot password functionality
✅ Goal field removed from signup
✅ All UI uses rounded-xl and dark theme
✅ Smooth transitions throughout

Test each feature individually after implementation!
