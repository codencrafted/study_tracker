import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { initializeApp } from "firebase/app";
import GenerateAITasks from './GenerateAITasks';

const firebaseConfig = {
  apiKey: "AIzaSyBaPuCdflLnZJkpEoEUZ6DTKCcQ9CmdLo4",
  authDomain: "turea-2452b.firebaseapp.com",
  projectId: "turea-2452b",
  storageBucket: "turea-2452b.firebasestorage.app",
  messagingSenderId: "406829970034",
  appId: "1:406829970034:web:807daf84c8b1f8bc5288eb",
  measurementId: "G-TWSJ9LVHX6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function Homepage({ uid, onLogout }) {
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showDropdown, setShowDropdown] = useState(null);
  const [taskStats, setTaskStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    completionRate: 0,
    todayCompleted: 0,
    thisWeekCompleted: 0,
    dailyStats: {},
    weeklyStats: {},
    taskHistory: []
  });
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showProgress, setShowProgress] = useState(true);

  // Helper function to remove undefined values from objects
  const removeUndefinedValues = (obj) => {
    const cleaned = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) {
        if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          cleaned[key] = removeUndefinedValues(obj[key]);
        } else {
          cleaned[key] = obj[key];
        }
      }
    });
    return cleaned;
  };

  // Calculate detailed task statistics
  const calculateTaskStats = (taskList) => {
    const now = new Date();
    const today = now.toDateString();
    const thisWeek = getWeekStart(now);
    
    const completed = taskList.filter(task => task.completed);
    const pending = taskList.filter(task => !task.completed);
    
    // Daily completion stats
    const dailyStats = {};
    const weeklyStats = {};
    
    completed.forEach(task => {
      if (task.completedAt) {
        const completedDate = new Date(task.completedAt);
        const dateStr = completedDate.toDateString();
        const weekStr = getWeekStart(completedDate).toDateString();
        
        dailyStats[dateStr] = (dailyStats[dateStr] || 0) + 1;
        weeklyStats[weekStr] = (weeklyStats[weekStr] || 0) + 1;
      }
    });

    const stats = {
      total: taskList.length,
      completed: completed.length,
      pending: pending.length,
      completionRate: taskList.length > 0 ? Math.round((completed.length / taskList.length) * 100) : 0,
      todayCompleted: dailyStats[today] || 0,
      thisWeekCompleted: weeklyStats[thisWeek.toDateString()] || 0,
      dailyStats: dailyStats,
      weeklyStats: weeklyStats,
      taskHistory: taskList.map(task => ({
        id: task.id || '',
        title: task.title || '',
        completed: task.completed || false,
        createdAt: task.createdAt || '',
        completedAt: task.completedAt || null,
        duration: task.duration || '30min'
      }))
    };

    // Remove any undefined values before returning
    return removeUndefinedValues(stats);
  };

  // Get start of week (Monday)
  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  // Get recent completion trends
  const getCompletionTrends = () => {
    const last7Days = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      last7Days.push({
        date: dateStr,
        completed: taskStats.dailyStats[dateStr] || 0,
        day: date.toLocaleDateString('en-US', { weekday: 'short' })
      });
    }
    
    return last7Days;
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, "study_tracker_user", uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserName(userData.name || '');
          const userTasks = userData.tasks || [];
          setTasks(userTasks);
          
          // Calculate and store task statistics
          const stats = calculateTaskStats(userTasks);
          setTaskStats(stats);
          
          // Update user document with latest stats
          const cleanStats = removeUndefinedValues(stats);
          await updateDoc(doc(db, "study_tracker_user", uid), {
            taskStats: cleanStats,
            lastUpdated: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
      setLoading(false);
    };

    fetchUserData();
  }, [uid]);

  // Update stats whenever tasks change
  useEffect(() => {
    const stats = calculateTaskStats(tasks);
    setTaskStats(stats);
  }, [tasks]);

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    const newTask = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
      duration: '30min',
      priority: 'medium'
    };

    try {
      const updatedTasks = [...tasks, newTask];
      const cleanStats = removeUndefinedValues(calculateTaskStats(updatedTasks));
      await updateDoc(doc(db, "study_tracker_user", uid), {
        tasks: updatedTasks,
        taskStats: cleanStats
      });
      setTasks(updatedTasks);
      setNewTaskTitle('');
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const handleTaskUpdate = async (taskId, updates) => {
    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        const updatedTask = { ...task, ...updates };
        // Add completion timestamp when task is marked as completed
        if (updates.completed && !task.completed) {
          updatedTask.completedAt = new Date().toISOString();
        } else if (updates.completed === false && task.completed) {
          delete updatedTask.completedAt;
        }
        return updatedTask;
      }
      return task;
    });
    
    try {
      const cleanStats = removeUndefinedValues(calculateTaskStats(updatedTasks));
      await updateDoc(doc(db, "study_tracker_user", uid), {
        tasks: updatedTasks,
        taskStats: cleanStats
      });
      setTasks(updatedTasks);
      setEditingTask(null);
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    const updatedTasks = tasks.filter(t => t.id !== taskId);
    try {
      const cleanStats = removeUndefinedValues(calculateTaskStats(updatedTasks));
      await updateDoc(doc(db, "study_tracker_user", uid), { 
        tasks: updatedTasks,
        taskStats: cleanStats
      });
      setTasks(updatedTasks);
      setShowDropdown(null);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const handleGeneratedTasks = async (generatedTasks) => {
    console.log("Generated tasks received:", generatedTasks);
    
    // Validate and clean generated tasks
    const newTasks = generatedTasks
      .filter(task => task && task.title) // Filter out invalid tasks
      .map(task => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        title: task.title.trim() || 'Untitled Task',
        completed: false,
        createdAt: new Date().toISOString(),
        duration: task.duration || '30min',
        priority: task.priority || 'medium'
      }));

    if (newTasks.length === 0) {
      console.warn("No valid tasks to add");
      return;
    }

    try {
      const updatedTasks = [...tasks, ...newTasks];
      const cleanStats = removeUndefinedValues(calculateTaskStats(updatedTasks));
      
      await updateDoc(doc(db, "study_tracker_user", uid), {
        tasks: updatedTasks,
        taskStats: cleanStats
      });
      setTasks(updatedTasks);
      console.log("Tasks successfully added to Firestore");
    } catch (error) {
      console.error("Error adding generated tasks:", error);
    }
  };

  const clearAllTasks = async () => {
    if (window.confirm('Are you sure you want to clear all tasks? This cannot be undone.')) {
      try {
        const emptyStats = removeUndefinedValues(calculateTaskStats([]));
        await updateDoc(doc(db, "study_tracker_user", uid), {
          tasks: [],
          taskStats: emptyStats
        });
        setTasks([]);
      } catch (error) {
        console.error("Error clearing tasks:", error);
      }
    }
  };

  const toggleDropdown = (taskId) => {
    setShowDropdown(showDropdown === taskId ? null : taskId);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowDropdown(null);
    };
    
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDropdown]);

  const completionTrends = getCompletionTrends();

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h2 style={{ 
        textAlign: 'center', 
        marginBottom: '30px',
        color: '#333'
      }}>
        Welcome to Study Tracker{userName ? `, ${userName}` : ''}
      </h2>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading...</p>
        </div>
      ) : (
        <div>
          {/* Enhanced Statistics Dashboard */}
          <div style={{
            backgroundColor: '#f8f9fa',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '30px',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: '0', color: '#495057' }}>📊 Your Progress</h3>
              <button
                onClick={() => setShowProgress(!showProgress)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: showProgress ? '#ffc107' : '#007bff',
                  color: showProgress ? '#333' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {showProgress ? 'Hide Progress' : 'Show Progress'}
              </button>
            </div>
            
            {showProgress && (
              <>
                {/* Quick Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                  <div style={{ textAlign: 'center', padding: '10px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>{taskStats.total}</div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>Total Tasks</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '10px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>{taskStats.completed}</div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>Completed</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '10px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>{taskStats.pending}</div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>Pending</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '10px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>{taskStats.completionRate}%</div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>Success Rate</div>
                  </div>
                </div>

                {/* Today & This Week */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#e8f5e8', borderRadius: '8px', border: '1px solid #c3e6cb' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#155724' }}>{taskStats.todayCompleted}</div>
                    <div style={{ fontSize: '12px', color: '#155724' }}>Completed Today</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#e1ecf4', borderRadius: '8px', border: '1px solid #b8daff' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#004085' }}>{taskStats.thisWeekCompleted}</div>
                    <div style={{ fontSize: '12px', color: '#004085' }}>This Week</div>
                  </div>
                </div>

                {/* Detailed Analytics */}
                {showAnalytics && (
                  <div style={{ marginTop: '20px', padding: '15px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>📈 7-Day Completion Trend</h4>
                    <div style={{ display: 'flex', alignItems: 'end', gap: '8px', height: '80px', marginBottom: '15px' }}>
                      {completionTrends.map((day, index) => (
                        <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div 
                            style={{ 
                              width: '100%', 
                              backgroundColor: day.completed > 0 ? '#28a745' : '#e9ecef',
                              height: `${Math.max(day.completed * 10, 4)}px`,
                              borderRadius: '2px',
                              marginBottom: '5px',
                              minHeight: '4px'
                            }}
                          ></div>
                          <div style={{ fontSize: '10px', color: '#6c757d' }}>{day.day}</div>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#495057' }}>{day.completed}</div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Task Completion Insights */}
                    <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px', fontSize: '14px' }}>
                      <strong>💡 Insights:</strong>
                      <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                        {taskStats.completionRate >= 80 && <li style={{ color: '#28a745' }}>Excellent completion rate! Keep it up! 🎉</li>}
                        {taskStats.completionRate >= 60 && taskStats.completionRate < 80 && <li style={{ color: '#ffc107' }}>Good progress! Try to maintain consistency 📈</li>}
                        {taskStats.completionRate < 60 && taskStats.completionRate > 0 && <li style={{ color: '#dc3545' }}>Focus on completing existing tasks before adding new ones 🎯</li>}
                        {taskStats.todayCompleted > 0 && <li style={{ color: '#17a2b8' }}>Great job completing {taskStats.todayCompleted} task{taskStats.todayCompleted > 1 ? 's' : ''} today! 💪</li>}
                        {taskStats.pending > 10 && <li style={{ color: '#6c757d' }}>Consider breaking down large tasks into smaller ones 📝</li>}
                      </ul>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* AI Task Generator - Pass enhanced stats */}
          <GenerateAITasks 
            onTasksGenerated={handleGeneratedTasks} 
            uid={uid}
            existingTasks={tasks}
            taskStats={taskStats}
          />

          {/* Manual Task Addition */}
          <div style={{ 
            marginBottom: '30px',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <h4 style={{ marginTop: '0', marginBottom: '15px', color: '#495057' }}>
              Add Task Manually
            </h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Enter task title..."
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #ced4da',
                  fontSize: '14px'
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
              />
              <button 
                onClick={handleAddTask}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Add Task
              </button>
            </div>
          </div>

          {/* Task List */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0', color: '#495057' }}>
                Your Tasks ({tasks.length})
              </h4>
              {tasks.length > 0 && (
                <button 
                  onClick={clearAllTasks}
                  style={{ 
                    padding: '8px 16px',
                    backgroundColor: '#dc3545', 
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Clear All
                </button>
              )}
            </div>

            {tasks.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px',
                color: '#6c757d',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '2px dashed #dee2e6'
              }}>
                <p style={{ margin: '0', fontSize: '16px' }}>
                  No tasks yet. Create some tasks using the AI assistant or add them manually!
                </p>
              </div>
            ) : (
              <div style={{ 
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #e9ecef'
              }}>
                {tasks.map((task, index) => (
                  <div 
                    key={task.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      padding: '16px',
                      borderBottom: index < tasks.length - 1 ? '1px solid #e9ecef' : 'none',
                      backgroundColor: task.completed ? '#f8f9fa' : 'white'
                    }}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleTaskUpdate(task.id, { completed: !task.completed })}
                      style={{
                        width: '18px',
                        height: '18px',
                        marginRight: '12px',
                        cursor: 'pointer'
                      }}
                    />
                    
                    {/* Task Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editingTask === task.id ? (
                        <input
                          type="text"
                          value={task.title}
                          onChange={(e) => handleTaskUpdate(task.id, { title: e.target.value })}
                          onBlur={() => setEditingTask(null)}
                          onKeyPress={(e) => e.key === 'Enter' && setEditingTask(null)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #007bff',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                          autoFocus
                        />
                      ) : (
                        <div>
                          <span style={{
                            fontSize: '14px',
                            color: task.completed ? '#6c757d' : '#212529',
                            textDecoration: task.completed ? 'line-through' : 'none',
                            wordBreak: 'break-word'
                          }}>
                            {task.title}
                          </span>
                          {task.duration && (
                            <span style={{
                              fontSize: '12px',
                              color: '#6c757d',
                              marginLeft: '8px',
                              fontStyle: 'italic'
                            }}>
                              ({task.duration})
                            </span>
                          )}
                          {task.completedAt && (
                            <div style={{
                              fontSize: '11px',
                              color: '#28a745',
                              marginTop: '2px'
                            }}>
                              ✅ Completed on {new Date(task.completedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Options Menu */}
                    <div style={{ position: 'relative', marginLeft: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDropdown(task.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '18px',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          color: '#6c757d'
                        }}
                      >
                        ⋮
                      </button>
                      
                      {showDropdown === task.id && (
                        <div style={{
                          position: 'absolute',
                          right: '0',
                          top: '100%',
                          backgroundColor: 'white',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                          zIndex: 1000,
                          minWidth: '120px'
                        }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTask(task.id);
                              setShowDropdown(null);
                            }}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '8px 12px',
                              border: 'none',
                              background: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(task.id);
                            }}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '8px 12px',
                              border: 'none',
                              background: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14px',
                              color: '#dc3545'
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Logout Button */}
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <button 
              onClick={onLogout}
              style={{
                padding: '12px 24px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Homepage;