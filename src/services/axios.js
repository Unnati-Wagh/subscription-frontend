import axios from 'axios'

const api = axios.create({
  // baseURL: 'https://dolorimetric-prosaically-constance.ngrok-free.dev',
  // headers: {
  //   'Content-Type': 'application/json' ,
  //   'ngrok-skip-browser-warning': 'true',
  // },
 // withCredentials: true,
  baseURL: 'http://43.204.19.1:1234',
  headers:{
    'Content-Type': 'application/json' ,
  },
})

api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('smp_token')
   
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    } 
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('smp_token')
      sessionStorage.removeItem('smp_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api