// ==========================================
// ECAMPUS Logic Core
// ==========================================
const sb = window.sb; 
let currentSession = null;

// Replace with your Cloudinary preset info
const CLOUDINARY_CLOUD_NAME = 'dnia8lb2q'; 
const CLOUDINARY_UPLOAD_PRESET = 'profiles'; 

async function checkAuth() {
    if(!sb) return; // Wait or throw error if not loaded
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = "/auth/login.html"; // Update with your login path
        return;
    }
    currentSession = session;
    
    fetchUserProfile(session.user.id);
    loadPosts();
    loadDiscoverStudents();
    loadNotifications();
}

async function fetchUserProfile(authUserId) {
    try {
        const { data: user, error } = await sb
            .from('users')
            .select('full_name, profile_img_url, role, course, student_id, email, bio, social_links, is_private') 
            .eq('auth_user_id', authUserId)
            .single();

        if (error) throw error; 

        if (user) {
            const avatarUrl = user.profile_img_url || `https://ui-avatars.com/api/?name=${user.full_name}&background=e1e3e4`;
            ['header-avatar', 'profile-avatar-large', 'feed-input-avatar'].forEach(id => {
                const el = document.getElementById(id);
                if(el) el.src = avatarUrl;
            });

            document.getElementById('profile-name').innerText = user.full_name;
            document.getElementById('profile-role').innerText = user.role || 'Student';
            document.getElementById('profile-id').innerText = user.student_id || 'N/A';
            document.getElementById('profile-course').innerText = user.course || 'N/A';
            document.getElementById('profile-bio').innerText = user.bio || 'Passionate about campus life! 🌱';
            document.getElementById('profile-email').innerHTML = `<span class="material-symbols-outlined text-[16px]">mail</span> ${user.email}`;
            
            const privacyToggle = document.getElementById('privacy-toggle-switch');
            if(privacyToggle) privacyToggle.checked = user.is_private;

            renderMySocialLinks(user.social_links);
        }
    } catch (err) {
        console.error("Profile fetch error:", err.message);
    }
}

window.submitPost = async function() {
    const input = document.getElementById('post-input');
    const btn = document.getElementById('send-post-btn');
    const content = input.value.trim();

    if (!content || !currentSession) return;

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">sync</span>';

    try {
        const { error } = await sb.from('posts').insert({
            user_id: currentSession.user.id,
            content: content
        });
        if (error) throw error;
        input.value = '';
        await loadPosts();
    } catch (err) {
        console.error("Failed to post:", err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-[20px] ml-1">send</span>';
    }
};

async function loadPosts() {
    const container = document.getElementById('feed-posts-container');
    if (!container) return;

    try {
        const { data: posts, error } = await sb.from('posts').select(`
            id, content, likes, created_at,
            users!posts_user_id_fkey(full_name, profile_img_url)
        `).order('created_at', { ascending: false }).limit(30);

        if (error) throw error;

        container.innerHTML = posts.length > 0 ? posts.map(p => {
            const img = p.users.profile_img_url || `https://ui-avatars.com/api/?name=${p.users.full_name}&background=e1e3e4`;
            return `
            <div class="bg-surface-container-lowest dark:bg-[#1e1e1e] rounded-[32px] p-5 border border-surface-variant/60 shadow-sm mb-5 animate-fadeIn">
                <div class="flex items-center gap-3 mb-3">
                    <img src="${img}" class="w-10 h-10 rounded-full border border-surface-variant object-cover">
                    <div class="flex-1">
                        <h4 class="font-bold text-[14px] text-on-surface">${p.users.full_name}</h4>
                        <p class="text-[11px] text-on-surface-variant mt-0.5">Stream Update</p>
                    </div>
                </div>
                <p class="text-[14px] text-on-surface leading-relaxed mb-4 px-1">${p.content}</p>
                <div class="flex items-center gap-6 border-t border-surface-variant/40 pt-3 px-1">
                    <button class="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-[13px] font-medium">
                        <span class="material-symbols-outlined text-[20px]">favorite</span> ${p.likes || 0}
                    </button>
                    <button class="flex items-center gap-1.5 text-on-surface-variant hover:text-secondary transition-colors text-[13px] font-medium">
                        <span class="material-symbols-outlined text-[20px]">chat_bubble</span> Reply
                    </button>
                </div>
            </div>`;
        }).join('') : '<p class="text-sm italic text-center py-4 text-on-surface-variant">No posts available.</p>';
    } catch(e) {
        console.error(e);
    }
}

let allDiscoverUsers = []; 

async function loadDiscoverStudents() {
    const container = document.getElementById('discover-students-container'); 
    if (!container) return;

    try {
        const { data: users, error } = await sb.from('users')
            .select('auth_user_id, full_name, course, profile_img_url, bio, is_private, connection_count')
            .neq('auth_user_id', currentSession.user.id)
            .order('connection_count', { ascending: false })
            .limit(15);

        if (error) throw error;
        allDiscoverUsers = users;

        container.innerHTML = users.map((u, i) => {
            const img = u.profile_img_url || `https://ui-avatars.com/api/?name=${u.full_name}&background=e1e3e4`;
            return `
            <div onclick="viewStudentProfile(${i})" class="bg-surface-container-lowest dark:bg-[#1e1e1e] rounded-[24px] p-4 border border-surface-variant/60 shadow-sm flex items-center gap-4 cursor-pointer active:scale-95 transition-transform animate-fadeIn">
                <div class="w-[52px] h-[52px] rounded-full p-[2px] ${u.is_private ? 'bg-surface-variant' : 'bg-gradient-to-tr from-primary to-blue-500'} shrink-0">
                    <div class="w-full h-full rounded-full border-2 border-surface overflow-hidden"><img src="${img}" class="w-full h-full object-cover"></div>
                </div>
                <div class="flex-1">
                    <h4 class="text-[15px] font-bold text-on-surface flex items-center gap-1">${u.full_name} ${u.is_private ? '<span class="material-symbols-outlined text-[14px]">lock</span>' : ''}</h4>
                    <p class="text-[12px] text-on-surface-variant mt-0.5">${u.course || 'Student'} • ${u.connection_count || 0} Conns</p>
                </div>
                <button class="bg-primary/10 text-primary px-4 py-2 rounded-xl text-[12px] font-bold shrink-0">View</button>
            </div>`;
        }).join('');
    } catch(e) {}
}

window.viewStudentProfile = function(index) {
    const user = allDiscoverUsers[index];
    const img = user.profile_img_url || `https://ui-avatars.com/api/?name=${user.full_name}&background=e1e3e4`;
    
    if (user.is_private) {
        document.getElementById('private-profile-name').innerText = user.full_name;
        document.getElementById('private-profile-course').innerText = user.course || 'Student';
        document.getElementById('private-profile-avatar').src = img;
        
        document.getElementById('private-connect-btn').onclick = () => requestConnection(user.auth_user_id);
        openProfileModal('private');
    } else {
        document.getElementById('public-profile-name').innerText = user.full_name;
        document.getElementById('public-profile-course').innerText = user.course || 'Student';
        document.getElementById('public-profile-bio').innerText = user.bio || 'No bio attached.';
        document.getElementById('public-profile-avatar').src = img;
        
        document.getElementById('public-connect-btn').onclick = () => requestConnection(user.auth_user_id);
        openProfileModal('public');
    }
};

window.requestConnection = async function(receiverId) {
    if(!currentSession) return;
    try {
        const { error } = await sb.from('connections').insert({
            requester_id: currentSession.user.id,
            receiver_id: receiverId,
            status: 'pending' 
        });
        if (error) throw error;
        alert("Connection request sent!");
        closeProfileModals();
    } catch(err) {
        alert("Connection already requested or unable to process.");
    }
}

async function loadNotifications() {
    const container = document.getElementById('notifications-container');
    const badge = document.getElementById('notif-badge');
    if (!container || !currentSession) return;

    try {
        const { data: notifs, error } = await sb.from('notifications')
            .select('*')
            .eq('user_id', currentSession.user.id)
            .order('created_at', { ascending: false });

        if(error) throw error;

        const unread = notifs.filter(n => !n.is_read).length;
        if(badge) badge.style.display = unread > 0 ? 'block' : 'none';

        container.innerHTML = notifs.length > 0 ? notifs.map(n => `
            <div onclick="markNotifRead('${n.id}')" class="p-5 border-b border-surface-variant/50 cursor-pointer transition-colors ${!n.is_read ? 'bg-primary/5' : ''}">
                <div class="flex gap-4">
                    <div class="w-12 h-12 rounded-full ${n.type==='alert' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'} flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined">${n.type==='alert' ? 'warning' : 'notifications'}</span>
                    </div>
                    <div>
                        <p class="text-[14px] text-on-surface leading-snug">${n.message}</p>
                        <span class="text-[11px] text-on-surface-variant mt-2 block font-medium">System Alert</span>
                    </div>
                </div>
            </div>
        `).join('') : '<p class="text-sm text-center py-10 text-on-surface-variant">No new notifications.</p>';
    } catch(e) {}
}

window.markNotifRead = async function(notifId) {
    try {
        await sb.from('notifications').update({ is_read: true }).eq('id', notifId);
        loadNotifications();
    } catch(e) { }
}

function setupProfileImageUpload() {
    const avatarContainer = document.getElementById('profile-avatar-container');
    const fileInput = document.getElementById('avatar-upload-input');
    const largeAvatarImg = document.getElementById('profile-avatar-large');

    if (!avatarContainer || !fileInput) return;

    avatarContainer.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        largeAvatarImg.style.opacity = '0.5';

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST', body: formData
            });
            const data = await uploadRes.json();
            if (!uploadRes.ok) throw new Error("Cloudinary rejected.");

            await sb.from('users').update({ profile_img_url: data.secure_url }).eq('auth_user_id', currentSession.user.id);
            largeAvatarImg.src = data.secure_url;
            document.getElementById('header-avatar').src = data.secure_url;
        } catch (err) {
            alert(`Upload failed`);
        } finally {
            largeAvatarImg.style.opacity = '1';
        }
    });
}

function renderMySocialLinks(linksObj) {
    const container = document.getElementById('profile-social-links');
    if (!container) return;
    
    container.innerHTML = ''; 
    if (linksObj && Object.keys(linksObj).length > 0) {
        Object.entries(linksObj).forEach(([platform, url]) => {
            if (url) {
                container.innerHTML += `
                    <a href="${url}" target="_blank" class="w-12 h-12 rounded-2xl bg-surface-variant/40 text-on-surface flex items-center justify-center cursor-pointer shadow-sm border border-surface-variant/50">
                        <span class="font-bold text-[14px] capitalize">${platform.substring(0,2)}</span>
                    </a>
                `;
                const inputEl = document.getElementById(`input-social-${platform}`);
                if(inputEl) inputEl.value = url;
            }
        });
    } else {
        container.innerHTML = `<p class="text-xs text-on-surface-variant italic py-2">No social links added yet.</p>`;
    }
}

window.saveSocialLinks = async function() {
    if (!currentSession) return;
    const nextLinks = {
        instagram: document.getElementById('input-social-instagram')?.value.trim() || '',
        linkedin: document.getElementById('input-social-linkedin')?.value.trim() || '',
        github: document.getElementById('input-social-github')?.value.trim() || ''
    };
    Object.keys(nextLinks).forEach(k => { if (!nextLinks[k]) delete nextLinks[k]; });

    await sb.from('users').update({ social_links: nextLinks }).eq('auth_user_id', currentSession.user.id);
    renderMySocialLinks(nextLinks);
    document.getElementById('modal-edit-socials').classList.replace('flex','hidden');
};

const privacyEl = document.getElementById('privacy-toggle-switch');
if(privacyEl) {
    privacyEl.addEventListener('change', async (e) => {
        if (currentSession) await sb.from('users').update({ is_private: e.target.checked }).eq('auth_user_id', currentSession.user.id);
    });
}

function initThemeAndEvents() {
    const savedTheme = localStorage.getItem('ecoCampusTheme') || 'light';
    document.documentElement.setAttribute('class', savedTheme);
    const themeCheckbox = document.getElementById('theme-toggle-switch');
    if(themeCheckbox) {
        themeCheckbox.checked = (savedTheme === 'dark');
        themeCheckbox.addEventListener('change', (e) => {
            const newTheme = e.target.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('class', newTheme);
            localStorage.setItem('ecoCampusTheme', newTheme);
        });
    }

    const notifBtn = document.getElementById('notif-btn');
    const closeNotifBtn = document.getElementById('close-notif-btn');
    const fullNotifPanel = document.getElementById('full-notif-panel');

    if(notifBtn && closeNotifBtn && fullNotifPanel) {
        notifBtn.addEventListener('click', () => { fullNotifPanel.classList.remove('translate-x-full'); document.body.style.overflow = 'hidden'; });
        closeNotifBtn.addEventListener('click', () => { fullNotifPanel.classList.add('translate-x-full'); document.body.style.overflow = 'auto'; });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initThemeAndEvents();
    checkAuth();
    setupProfileImageUpload();
});
