import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

function GenerateAITasks({ onTasksGenerated, uid, existingTasks = [], taskStats = {} }) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false);
  const [tempTasks, setTempTasks] = useState(null);
  const [showAssistant, setShowAssistant] = useState(true);

  // Load chat history from Firestore on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        if (!uid) return;
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, "study_tracker_user", uid));
        if (userDoc.exists() && userDoc.data().chatHistory) {
          setChatHistory(userDoc.data().chatHistory);
        }
      } catch (error) {
        console.error("Error loading chat history:", error);
      }
    };
    loadChatHistory();
  }, [uid]);

  // Save chat history to Firestore on change
  useEffect(() => {
    const saveChatHistory = async () => {
      if (!uid || chatHistory.length === 0) return;
      try {
        const db = getFirestore();
        await updateDoc(doc(db, "study_tracker_user", uid), {
          chatHistory: chatHistory,
          lastChatUpdate: new Date().toISOString()
        });
      } catch (error) {
        console.error("Error saving chat history:", error);
      }
    };
    saveChatHistory();
  }, [chatHistory, uid]);

  // Get comprehensive task analysis
  const getTaskAnalysis = () => {
    const analysis = {
      totalTasks: taskStats.total || 0,
      completedTasks: taskStats.completed || 0,
      pendingTasks: taskStats.pending || 0,
      completionRate: taskStats.completionRate || 0,
      todayCompleted: taskStats.todayCompleted || 0,
      thisWeekCompleted: taskStats.thisWeekCompleted || 0,
      recentTasks: existingTasks.slice(-5).map(task => ({
        title: task.title || 'Untitled Task',
        completed: task.completed || false,
        duration: task.duration || '30min'
      }))
    };

    // Performance insights
    const insights = [];
    if (analysis.completionRate >= 80) {
      insights.push("High performer - excellent completion rate");
    } else if (analysis.completionRate >= 60) {
      insights.push("Good progress - room for improvement");
    } else if (analysis.completionRate > 0) {
      insights.push("Needs focus - many incomplete tasks");
    }

    if (analysis.pendingTasks > 15) {
      insights.push("Too many pending tasks - prioritize completion");
    }

    if (analysis.todayCompleted > 3) {
      insights.push("Very productive today");
    }

    return { ...analysis, insights };
  };

  // Enhanced system prompt with comprehensive memory
  const createSystemPrompt = (isTaskRequest) => {
    const analysis = getTaskAnalysis();
    
    if (isTaskRequest) {
      return `You are an intelligent task assistant with complete memory of the user's progress.

CURRENT USER STATUS:
📊 Total Tasks: ${analysis.totalTasks}
✅ Completed: ${analysis.completedTasks}
⏳ Pending: ${analysis.pendingTasks}
📈 Success Rate: ${analysis.completionRate}%
🎯 Today Completed: ${analysis.todayCompleted}
📅 This Week: ${analysis.thisWeekCompleted}

RECENT TASKS:
${analysis.recentTasks.map(task => `• ${task.title} (${task.completed ? '✅ Done' : '⏳ Pending'}) - ${task.duration}`).join('\n')}

PERFORMANCE INSIGHTS:
${analysis.insights.map(insight => `• ${insight}`).join('\n')}

TASK CREATION RULES:
1. Consider user's current workload (${analysis.pendingTasks} pending tasks)
2. If completion rate < 60%, suggest fewer, easier tasks
3. If > 15 pending tasks, recommend focusing on existing ones first
4. Create specific, actionable tasks with appropriate difficulty
5. Format as numbered list: "1. Task name"
6. Keep tasks realistic based on their performance pattern

INTELLIGENT RECOMMENDATIONS:
${analysis.completionRate < 50 ? 
  "⚠️ User struggles with completion - suggest 2-3 simple tasks max" : 
  analysis.pendingTasks > 15 ? 
    "📋 Too many pending - recommend task prioritization instead" :
    "✅ Good capacity - can handle 3-5 new tasks"
}

Create tasks that match the user's current capacity and help improve their success rate.`;
    } else {
      return `You are a helpful task assistant with complete memory of the user's progress.

USER CONTEXT:
📊 Tasks: ${analysis.totalTasks} total, ${analysis.completedTasks} completed (${analysis.completionRate}% success rate)
🎯 Recent Activity: ${analysis.todayCompleted} completed today, ${analysis.thisWeekCompleted} this week
📋 Current Load: ${analysis.pendingTasks} pending tasks

INSIGHTS: ${analysis.insights.join(', ')}

Help the user with productivity advice, task management, and motivation based on their actual performance data.`;
    }
  };

  // Enhanced task parsing with better pattern recognition and null safety
  const parseTasksFromResponse = (aiResponse) => {
    const tasks = [];
    const lines = aiResponse.split('\n').filter(line => line.trim());
    
    for (let line of lines) {
      line = line.trim();
      
      // Skip headers, recommendations, and metadata
      if (line.startsWith('**') && line.endsWith('**')) continue;
      if (line.includes('Roadmap') || line.includes('Recommendation')) continue;
      if (line.includes('Important') || line.includes('Note:')) continue;
      if (line.includes('Total:') || line.includes('Status:')) continue;
      if (line.length < 5) continue; // Skip very short lines
      
      // Enhanced task pattern matching
      const taskPatterns = [
        /^(\d+)[\.\)]\s*(.+)$/,           // "1. Task" or "1) Task"
        /^[\-\•\*]\s*(.+)$/,             // "- Task" or "• Task" or "* Task"
        /^Task\s*\d*:\s*(.+)$/i,         // "Task 1: Description"
        /^Step\s*\d*:\s*(.+)$/i,         // "Step 1: Description"
        /^(?:Do|Complete|Finish|Study|Practice|Review|Learn|Read|Write|Solve)\s+(.+)$/i // Action verbs
      ];
      
      for (let pattern of taskPatterns) {
        const match = line.match(pattern);
        if (match) {
          let taskTitle = (match[2] || match[1] || '').trim();
          
          // Skip if no valid title found
          if (!taskTitle || taskTitle.length < 3) continue;
          
          // Clean up task title
          taskTitle = taskTitle.replace(/^\*\*|\*\*$/g, ''); // Remove bold
          taskTitle = taskTitle.replace(/^[\(\[\{].*?[\)\]\}]\s*/, ''); // Remove prefixes like "(Day 1)"
          
          // Extract duration if mentioned
          const durationMatch = taskTitle.match(/\((\d+\s*(?:min|minutes|hour|hours|hrs?))\)/i);
          let duration = '30min'; // default
          if (durationMatch && durationMatch[1]) {
            duration = durationMatch[1].toLowerCase().replace(/s$/, ''); // Remove plural 's'
            taskTitle = taskTitle.replace(durationMatch[0], '').trim();
          }
          
          // Extract priority if mentioned
          let priority = 'medium';
          if (taskTitle.toLowerCase().includes('urgent') || taskTitle.toLowerCase().includes('important')) {
            priority = 'high';
          } else if (taskTitle.toLowerCase().includes('easy') || taskTitle.toLowerCase().includes('simple')) {
            priority = 'low';
          }
          
          // Create task object with guaranteed non-undefined values
          if (taskTitle && taskTitle.length >= 3) {
            const newTask = {
              title: taskTitle,
              duration: duration || '30min',
              priority: priority || 'medium',
              completed: false,
              createdAt: new Date().toISOString(),
              description: '', // Ensure this field exists
              category: 'AI Generated' // Add category
            };
            
            // Validate all fields are defined
            const isValid = Object.values(newTask).every(value => value !== undefined && value !== null);
            if (isValid) {
              tasks.push(newTask);
            } else {
              console.warn('Skipping invalid task:', newTask);
            }
          }
          break; // Found a pattern, move to next line
        }
      }
    }

    console.log('Parsed tasks:', tasks);
    return tasks.length > 0 ? tasks : null;
  };

  // Check if user input is asking for tasks
  const isTaskRequest = (userInput) => {
    const taskKeywords = [
      'add', 'create', 'make', 'generate', 'build', 'plan', 'schedule',
      'task', 'todo', 'list', 'assignment', 'homework', 'study', 'practice',
      'learn', 'review', 'prepare', 'work', 'project', 'goal'
    ];
    const lowerInput = userInput.toLowerCase();
    return taskKeywords.some(keyword => lowerInput.includes(keyword));
  };

  // Smart task recommendations based on user's performance
  const getSmartRecommendations = () => {
    const analysis = getTaskAnalysis();
    const recommendations = [];

    if (analysis.completionRate < 50 && analysis.pendingTasks > 5) {
      recommendations.push("🎯 Focus on completing existing tasks before adding new ones");
      recommendations.push("💡 Try breaking large tasks into smaller, manageable pieces");
    }

    if (analysis.pendingTasks > 20) {
      recommendations.push("📋 Consider archiving or removing low-priority tasks");
    }

    if (analysis.completionRate > 80) {
      recommendations.push("🌟 Great job! You're ready for more challenging tasks");
    }

    if (analysis.todayCompleted === 0 && analysis.pendingTasks > 0) {
      recommendations.push("⚡ Start with one small task to build momentum");
    }

    return recommendations;
  };

  const handleUserInput = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setError('');

    try {
      const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
      let newHistory = [...chatHistory, { role: 'user', content: prompt }];

      const analysis = getTaskAnalysis();
      const systemPrompt = createSystemPrompt(isTaskRequest(prompt));

      // Create enhanced conversation context
      let conversationContext = '';
      if (newHistory.length > 1) {
        conversationContext = newHistory.slice(-6, -1).map(msg => // Last 6 messages for context
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n\n') + '\n\n';
      }

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      let finalPrompt = systemPrompt + '\n\n' + conversationContext + 'User: ' + prompt;

      const result = await model.generateContent(finalPrompt);
      const aiMsg = result.response.text();

      // Handle confirmation flow
      if (waitingForConfirmation) {
        const userResponse = prompt.toLowerCase().trim();
        if (userResponse.includes('yes') || userResponse === 'y') {
          if (tempTasks && tempTasks.length > 0) {
            // Validate tasks before sending to parent
            const validTasks = tempTasks.filter(task => {
              const isValid = task.title && 
                           task.duration && 
                           task.priority && 
                           typeof task.completed === 'boolean';
              if (!isValid) {
                console.warn('Filtering out invalid task:', task);
              }
              return isValid;
            });

            if (validTasks.length > 0) {
              onTasksGenerated(validTasks);
              newHistory.push({ 
                role: 'ai', 
                content: `✅ Perfect! I've added ${validTasks.length} tasks to your list.\n\n📊 Updated Status: ${analysis.totalTasks + validTasks.length} total tasks\n💡 Remember to focus on completion to maintain your ${analysis.completionRate}% success rate!` 
              });
              console.log('Tasks added:', validTasks);
            } else {
              newHistory.push({ role: 'ai', content: 'Sorry, there was an issue with the task format. Please try again.' });
            }
          } else {
            newHistory.push({ role: 'ai', content: 'Sorry, there was an issue adding the tasks. Please try again.' });
          }
        } else if (userResponse.includes('no') || userResponse === 'n') {    
          newHistory.push({ role: 'ai', content: 'No problem! What else can I help you with? I can suggest ways to improve your current completion rate or help prioritize existing tasks.' });
        } else {
          newHistory.push({ role: 'ai', content: 'Please respond with "yes" to add the tasks or "no" to cancel.' });
          setChatHistory(newHistory);
          setPrompt('');
          setGenerating(false);
          return;
        }
        setWaitingForConfirmation(false);
        setTempTasks(null);
      } else {
        newHistory.push({ role: 'ai', content: aiMsg });

        // Try to extract tasks from AI response if it's a task request
        if (isTaskRequest(prompt)) {
          const foundTasks = parseTasksFromResponse(aiMsg);
          
          if (foundTasks && foundTasks.length > 0) {
            // Check if user can handle more tasks
            if (analysis.pendingTasks > 15 && analysis.completionRate < 60) {
              const warningMsg = `\n\n⚠️ RECOMMENDATION: You currently have ${analysis.pendingTasks} pending tasks with a ${analysis.completionRate}% completion rate. Consider completing some existing tasks first to improve your success rate.\n\nWould you still like to add these ${foundTasks.length} new tasks? (Type "yes" to add anyway or "no" to focus on existing tasks)`;
              newHistory[newHistory.length - 1].content = aiMsg + warningMsg;
            } else {
              const taskList = foundTasks.map((task, idx) => 
                `${idx + 1}. ${task.title} (${task.duration}) [${task.priority} priority]`
              ).join('\n');
              
              const confirmationMsg = `\n\n📋 I found these ${foundTasks.length} tasks to add:\n\n${taskList}\n\n💡 This will bring your total to ${analysis.totalTasks + foundTasks.length} tasks.\n\nConfirm? (Type "yes" to add or "no" to cancel)`;
              newHistory[newHistory.length - 1].content = aiMsg + confirmationMsg;
            }
            
            setTempTasks(foundTasks);
            setWaitingForConfirmation(true);
          }
        }
      }

      setChatHistory(newHistory);
    } catch (err) {
      setError(`Error: ${err.message}`);
      console.error('AI Task Generation Error:', err);
    }

    setPrompt('');
    setGenerating(false);
  };

  const clearChatHistory = async () => {
    if (window.confirm('Are you sure you want to clear chat history? This will remove the AI\'s memory of your conversations.')) {
      setChatHistory([]);
      setWaitingForConfirmation(false);
      setTempTasks(null);
      
      if (uid) {
        const db = getFirestore();
        try {
          await updateDoc(doc(db, "study_tracker_user", uid), { 
            chatHistory: [],
            lastChatUpdate: new Date().toISOString()
          });
        } catch (error) {
          console.error("Error clearing chat history:", error);
        }
      }
    }
  };

  const analysis = getTaskAnalysis();
  const recommendations = getSmartRecommendations();

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Toggle AI Assistant Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <button
          onClick={() => setShowAssistant(v => !v)}
          style={{
            padding: '8px 16px',
            backgroundColor: showAssistant ? '#ffc107' : '#007bff',
            color: showAssistant ? '#333' : 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          {showAssistant ? 'Hide AI Assistant' : 'Show AI Assistant'}
        </button>
      </div>

      {showAssistant && (
        <>
          {/* Enhanced Header with Memory Indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <h3 style={{ margin: '0', color: '#495057' , marginLeft: "-35%" }}>AI Task Assistant</h3>
              <div style={{ fontSize: '0.85em', color: '#666', marginTop: '4px' }}>
                 Remembers: {analysis.totalTasks} tasks |  {analysis.completedTasks} done |  {analysis.completionRate}% rate
              </div>
            </div>
            {chatHistory.length > 0 && (
              <button 
                onClick={clearChatHistory}
                style={{ 
                  padding: '6px 12px',
                  fontSize: '0.8em',
                  color: '#666',
                  backgroundColor: 'transparent',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🗑️ Clear Memory
              </button>
            )}
          </div>

      
                {recommendations.length > 0 && (
                <div style={{
                  backgroundColor: '#e8f4fd',
                  border: '1px solid #b8daff',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '16px',
                  fontSize: '0.9em'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#004085' }}>
                  💡 Smart Recommendations:
                  </div>
                  {recommendations.map((rec, idx) => (
                  <div key={idx} style={{ marginBottom: '4px', color: '#004085', textAlign: 'left' }}>
                    {rec}
                  </div>
                  ))}
                </div>
                )}
                
             
                    <div style={{ 
                    border: '1px solid #dee2e6', 
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '16px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    backgroundColor: '#f8f9fa'
                    }}>
                    {chatHistory.length === 0 && (
                      <div style={{ color: '#666', textAlign: 'left', padding: '20px' }}>
                      
                     
                      <div style={{ fontSize: '0.9em', display: "flex", justifyContent: "left", flexDirection: "column", textAlign: 'left' }}>
                        <strong>Try asking me:</strong><br/>
                        • Create 3 Python practice tasks<br/>
                        • Add study tasks for my math exam<br/>
                        • Help me prioritize my pending tasks<br/>
                        • What should I focus on today?
                      </div>
                      </div>
                    )}
                    
                    {chatHistory.map((message, index) => (
                      <div 
                      key={index}
                      style={{
                        marginBottom: '12px',
                        textAlign: message.role === 'user' ? 'right' : 'left',
                      }}
                      >
                      <div style={{
                        display: 'inline-block',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        backgroundColor: message.role === 'user' ? '#007bff' : '#ffffff',
                        color: message.role === 'user' ? 'white' : '#333',
                        maxWidth: '85%',
                        textAlign: 'left',
                        whiteSpace: 'pre-wrap',
                        border: message.role === 'ai' ? '1px solid #dee2e6' : 'none',
                        boxShadow: message.role === 'ai' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                      }}>
                        {message.role === 'ai' && <span style={{ fontSize: '0.8em', color: '#666' }}>🤖 AI Assistant</span>}
                        <div style={{ marginTop: message.role === 'ai' ? '4px' : '0' }}>
                        {message.content}
                        </div>
                      </div>
                      </div>
                    ))}
                    
                    {generating && (
                      <div style={{ textAlign: 'left', marginBottom: '12px' }}>
                      <div style={{
                        display: 'inline-block',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #dee2e6',
                        color: '#666'
                      }}>
                        <span style={{ fontSize: '0.8em' }}>🤖 AI Assistant</span>
                        <div style={{ marginTop: '4px' }}>
                         Analyzing your progress and thinking... 
                        </div>
                      </div>
                      </div>
                    )}
                    </div>

                    {/* Enhanced Input Form */}
          <form onSubmit={handleUserInput}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  waitingForConfirmation ? 
                    "Type 'yes' to confirm or 'no' to cancel..." : 
                    analysis.pendingTasks > 15 ? 
                      "Ask for help with existing tasks or productivity tips..." :
                      "Ask me to create tasks or help with productivity..."
                }
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #ced4da',
                  fontSize: '14px'
                }}
              />
              <button 
                type="submit" 
                disabled={generating || !prompt.trim()}
                style={{
                  padding: '12px 20px',
                  backgroundColor: generating || !prompt.trim() ? '#ccc' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: generating || !prompt.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  minWidth: '80px'
                }}
              >
                {generating ? '🧠' : <span class="material-symbols-outlined">
arrow_right_alt
</span>}
              </button>
            </div>
          </form>
          
          {error && (
            <div style={{ 
              color: '#dc3545', 
              marginTop: '8px', 
              fontSize: '14px',
              padding: '8px',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '4px'
            }}>
              ❌ {error}
            </div>
          )}
          
          {waitingForConfirmation && (
            <div style={{ 
              marginTop: '8px', 
              padding: '10px', 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffeaa7',
              borderRadius: '4px',
              fontSize: '14px',
              color: '#856404'
            }}>
              ⏳ Waiting for your confirmation... The AI remembers your current progress and is making smart recommendations.
            </div>
          )}

          {/* Performance Tip */}
          {analysis.completionRate < 60 && analysis.totalTasks > 0 && (
            <div style={{
              marginTop: '12px',
              padding: '10px',
              backgroundColor: '#ffeaa7',
              border: '1px solid #f39c12',
              borderRadius: '4px',
              fontSize: '0.85em',
              color: '#856404'
            }}>
              <strong>💡 Productivity Tip:</strong> Your completion rate is {analysis.completionRate}%. 
              Focus on finishing existing tasks to build momentum and improve your success rate!
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default GenerateAITasks;