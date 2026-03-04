import {
  createConnectedConnectionCard,
  createReceivedConnectionCard,
  createSugguestionConnectionCard,
  createSentConnectionCard,
  createDiscoveryConnectionCard
} from './connection.templates.js'
/*
export function renderConnectedConnections(sectionTab){
  const connectionsData = connectionState.getConnectionsData('connected');
  document.getElementById("advanced-connected-options").classList.remove('hidden');
  if(!connectionsData){
    sectionTab.innerHTML = showEmptyConnected();
  }
  sectionTab.innerHTML = connectionsData.map(connection => {
    createConnectedConnectionsCard(connection)}.join("");
  
    
  }
}
export function renderReceivedConnections(sectionTab){
  const connectionsData = connectionState.getConnectionsData('received');
  document.getElementById("advanced-connected-options").classList.remove('hidden');
  if(!connectionsData){
    sectionTab.innerHTML = showEmptyReceived();
  
  }
  sectionTab.innerHTML = connectionsData.map(connection => {
    createReceivedConnectionCard(connection).join("");
  })
}
export function renderSugguestedConnections(sectionTab){
  const connectionsData = connectionState.getConnectionsData('sugguestions');
  document.getElementById("advanced-connected-options").classList.remove('hidden');
  if(!connectionsData){
    sectionTab.innerHTML = showEmptySugguested();
  }
  sectionTab.innerHTML = connectionsData.map(connection => {
    createSugguestedConnectionCard(connection).join("");
  })
}

export function renderSentConnections(sectionTab){
  const connectionsData = connectionState.getConnectionsData('sent');
  document.getElementById("advanced-connected-options").classList.remove('hidden');
  if(!connectionsData){
    sectionTab.innerHTML = showEmptyConnected();
  }
  sectionTab.innerHTML = connectionsData.map(connection => {
    createSentConnectionCard(connection).join("");
  })
}
export function renderDiscoveryConnections(sectionTab){
  const connectionsData = connectionState.getConnectionsData('discovery');
  document.getElementById("advanced-connected-options").classList.remove('hidden');
  if(!connectionsData){
    sectionTab.innerHTML = showEmptyDiscovery();
  }
  sectionTab.innerHTML = connectionsData.map(connection => {
    createDiscoveryConnectionCard(connection).join("");
  })
}

*/
export function showUserAvatar(src){
  const avatarModal = document.getElementById("avatar-modal");
  avatarModal.classList.remove('hidden');
  avatarModal.querySelector("img").src = src;
}
function showError(message) {
            const errorContainer = document.getElementById('error-container');
            errorContainer.innerHTML = `
                <div class="error-message">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>${message}</span>
                </div>
            `;
            document.getElementById('loading-section').style.display = 'none';
        }

        

function startStream(userId) {
            api.get(`/connections/overview/${userId}`).then(response => {
                if (!response.ok) {
                    throw new Error('Failed to connect');
                }
                
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                
                // Hide loader and show AI section
                document.getElementById('loading-section').style.display = 'none';
                document.getElementById('ai-section').style.display = 'block';
                
                function readStream() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            // Stream complete
                            document.getElementById('streaming-indicator').style.display = 'none';
                            return;
                        }
                        
                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n');
                        
                        lines.forEach(line => {
                            if (line.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    
                                    // Handle content streaming
                                    if (data.content) {
                                        fullResponse += data.content;
                                        document.getElementById('ai-text').textContent = fullResponse;
                                    }
                                    
                                    // Handle completion
                                    if (data.type === 'done') {
                                        document.getElementById('streaming-indicator').style.display = 'none';
                                        
                                        if (data.already_connected) {
                                            document.getElementById('success-message').innerHTML = 
                                                '<div class="success-message">✓ You are already connected with this user</div>';
                                        }
                                    }
                                    
                                    // Handle errors
                                    if (data.error) {
                                        showError(data.error);
                                    }
                                    
                                } catch (e) {
                                    console.error('Parse error:', e, line);
                                }
                            }
                        });
                        
                        readStream();
                    }).catch(err => {
                        console.error('Stream error:', err);
                        showError('Connection lost. Please try again.');
                    });
                }
                
                readStream();
            })
            .catch(err => {
                console.error('Fetch error:', err);
                showError('Failed to load connection overview. Please try again.');
            });
        }