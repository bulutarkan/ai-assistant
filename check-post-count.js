// Simple test to count posts
async function checkPostCount() {
  const baseUrl = 'https://ckhealthturkey.com';

  try {
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/posts?per_page=1&page=1`);
    const posts = await response.json();
    console.log('Post count response:', response.headers);
    console.log('Total posts header:', response.headers.get('x-wp-total'));
    console.log('Response:', posts);
  } catch (error) {
    console.log('Error:', error);
  }
}

checkPostCount();
