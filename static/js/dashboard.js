document.addEventListener('DOMContentLoaded', () => {
  if (!StudiousAuth.requireAuth()) return;

  const user = StudiousAuth.getCurrentUser();
  const firstNameEl = document.getElementById('profile-first-name');
  const fullNameEl = document.getElementById('profile-full-name');
  const pictureEl = document.getElementById('profile-picture');
  const placeholderEl = document.getElementById('profile-placeholder');
  const avatarBtn = document.getElementById('profile-avatar-btn');
  const fileInput = document.getElementById('profile-picture-input');

  if (firstNameEl) firstNameEl.textContent = user.firstName;
  if (fullNameEl) fullNameEl.textContent = `${user.firstName} ${user.lastName}`;

  function showProfilePicture(src) {
    if (!pictureEl || !placeholderEl) return;
    if (src) {
      pictureEl.src = src;
      pictureEl.classList.remove('hidden');
      placeholderEl.classList.add('hidden');
      return;
    }
    pictureEl.removeAttribute('src');
    pictureEl.classList.add('hidden');
    placeholderEl.classList.remove('hidden');
  }

  showProfilePicture(user.profilePicture);

  avatarBtn?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file?.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (StudiousAuth.updateProfilePicture(reader.result)) {
        showProfilePicture(reader.result);
      }
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  });

  const revealEls = document.querySelectorAll('.scroll-reveal');
  if (!revealEls.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const delay = Number(entry.target.dataset.revealDelay || 0) * 140;
        setTimeout(() => entry.target.classList.add('is-visible'), delay);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  revealEls.forEach((el) => observer.observe(el));
});
