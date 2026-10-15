const shareButton = document.querySelector('[data-share]');
const toast = document.querySelector('.toast');

shareButton.addEventListener('click', async () => {
  const shareData = { title: 'Hào VTT | Dịch vụ Roblox', url: window.location.href };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.classList.add('show');
      window.setTimeout(() => toast.classList.remove('show'), 2200);
    }
  } catch (error) {
    if (error.name !== 'AbortError') console.error('Không thể chia sẻ liên kết:', error);
  }
});