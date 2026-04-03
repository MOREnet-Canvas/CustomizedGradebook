// ===== MASTERY DASHBOARD BUTTON CREATOR - PROTOTYPE =====
// Paste this into browser console on a Canvas course settings page

(async function() {
    // Get course ID from URL
    const courseId = window.location.pathname.match(/courses\/(\d+)/)?.[1];
    if (!courseId) {
        alert('Could not find course ID. Make sure you are on a course settings page.');
        return;
    }

    // Get CSRF token
    const csrfToken = document.cookie.match(/_csrf_token=([^;]+)/)?.[1];
    if (!csrfToken) {
        alert('Could not find CSRF token. You may not be authenticated.');
        return;
    }

    // Get Canvas base URL
    const baseUrl = window.location.origin;

    // Create button HTML for the mastery dashboard
    const masteryButtonHtml = `<div style="margin: 16px 0;"><a style="display: block; padding: 14px; background: #005f9e; color: white; text-align: center; border-radius: 8px; text-decoration: none; font-size: 16px;" href="${baseUrl}/courses/${courseId}/pages/mastery-dashboard?cg_web=1" data-api-endpoint="${baseUrl}/api/v1/courses/${courseId}/pages/mastery-dashboard" data-api-returntype="Page">
    View Mastery Dashboard
</a>
<div style="font-size: 12px; color: #666; margin-top: 6px; text-align: center;">For parents/observers using the Canvas Parent app</div>
</div>`;

    // Function to create or update front page
    async function createMasteryDashboardButton() {
        try {
            console.log('Step 1: Checking if front page exists...');
            
            // Check if front page exists
            let frontPageResponse = await fetch(`${baseUrl}/api/v1/courses/${courseId}/front_page`, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-Token': csrfToken
                }
            });

            let frontPageExists = frontPageResponse.ok;
            let frontPage = frontPageExists ? await frontPageResponse.json() : null;

            console.log('Front page exists:', frontPageExists);

            if (frontPageExists) {
                // Update existing front page - prepend button
                console.log('Step 2: Updating existing front page...');
                const currentBody = frontPage.body || '';
                const newBody = masteryButtonHtml + '\n' + currentBody;

                const updateResponse = await fetch(`${baseUrl}/api/v1/courses/${courseId}/pages/${frontPage.url}`, {
                    method: 'PUT',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({
                        wiki_page: {
                            body: newBody
                        }
                    })
                });

                if (!updateResponse.ok) {
                    throw new Error(`Failed to update front page: ${updateResponse.statusText}`);
                }

                console.log('✅ Front page updated successfully!');
                alert('✅ Mastery Dashboard button added to existing front page!');
            } else {
                // Create new front page with button
                console.log('Step 2: Creating new front page...');
                
                const createResponse = await fetch(`${baseUrl}/api/v1/courses/${courseId}/pages`, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({
                        wiki_page: {
                            title: 'Home',
                            body: masteryButtonHtml,
                            published: true,
                            front_page: true
                        }
                    })
                });

                if (!createResponse.ok) {
                    throw new Error(`Failed to create front page: ${createResponse.statusText}`);
                }

                console.log('✅ Front page created successfully!');
                alert('✅ New front page created with Mastery Dashboard button!');
            }

            // Step 3: Create mastery-dashboard page (if it doesn't exist)
            console.log('Step 3: Creating mastery-dashboard page...');
            
            const masteryPageResponse = await fetch(`${baseUrl}/api/v1/courses/${courseId}/pages`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    wiki_page: {
                        title: 'Mastery Dashboard',
                        url: 'mastery-dashboard',
                        body: '<h2>Mastery Dashboard</h2><p>This is the mastery dashboard page.</p>',
                        published: true
                    }
                })
            });

            if (masteryPageResponse.ok) {
                console.log('✅ Mastery Dashboard page created!');
            } else if (masteryPageResponse.status === 400) {
                console.log('ℹ️ Mastery Dashboard page already exists');
            } else {
                console.warn('⚠️ Could not create Mastery Dashboard page:', masteryPageResponse.statusText);
            }

            console.log('🎉 All done! Refresh the course home page to see the button.');

        } catch (error) {
            console.error('❌ Error:', error);
            alert('❌ Error: ' + error.message);
        }
    }

    // Add button to settings page sidebar
    console.log('Looking for settings sidebar...');

    // Try multiple selectors for the right sidebar
    const sidebar = document.querySelector('#right-side') ||
                    document.querySelector('#right-side-wrapper') ||
                    document.querySelector('aside[id="right-side"]');

    if (!sidebar) {
        console.error('Could not find settings sidebar. Tried: #right-side, #right-side-wrapper, aside#right-side');
        alert('Could not find settings sidebar. Make sure you are on the course settings page.');
        return;
    }

    console.log('Found sidebar:', sidebar);

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'margin: 12px 0; padding: 12px; background: #f5f5f5; border-radius: 4px;';
    buttonContainer.id = 'mastery-dashboard-creator';

    const button = document.createElement('a');
    button.className = 'Button Button--link Button--link--has-divider Button--course-settings';
    button.href = '#';
    button.innerHTML = '🎯 Create Mastery Dashboard Button';
    button.style.cssText = 'display: block; padding: 10px; background: #0374B5; color: white !important; text-align: center; border-radius: 4px; text-decoration: none; font-size: 14px; font-weight: 600; margin-bottom: 8px;';

    button.onclick = (e) => {
        e.preventDefault();
        createMasteryDashboardButton();
    };

    button.onmouseenter = () => button.style.background = '#025a8c';
    button.onmouseleave = () => button.style.background = '#0374B5';

    const description = document.createElement('div');
    description.style.cssText = 'font-size: 12px; color: #666; text-align: center;';
    description.textContent = 'Creates the Mastery Dashboard page and adds a button to the course front page';

    buttonContainer.appendChild(button);
    buttonContainer.appendChild(description);

    // Insert after "Validate Links in Content" if it exists
    const validateLinksButton = Array.from(sidebar.querySelectorAll('a')).find(a =>
        a.textContent.includes('Validate Links')
    );

    if (validateLinksButton) {
        validateLinksButton.parentElement.insertAdjacentElement('afterend', buttonContainer);
        console.log('✅ Button added after "Validate Links in Content"');
    } else {
        // Fallback: add to top of sidebar
        sidebar.insertBefore(buttonContainer, sidebar.firstChild);
        console.log('✅ Button added to top of settings sidebar');
    }

    console.log('🎉 Prototype loaded! Click the button to create the Mastery Dashboard.');
})();