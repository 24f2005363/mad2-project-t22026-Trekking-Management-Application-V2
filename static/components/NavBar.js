export default {
    name: "NavBar",
    data() {
        return {
            currentRole: localStorage.getItem("user-role"),
            userName: localStorage.getItem("user-name")
        }
    },
    created() {
        // Simple listener to update navigation when login state changes
        window.addEventListener("auth-changed", () => {
            this.currentRole = localStorage.getItem("user-role")
            this.userName = localStorage.getItem("user-name")
        })
    },
    methods: {
        async logoutUser() {
            try {
                await fetch("/api/sign-out")
            } catch (err) {
                console.log("Logout API call error")
            }
            localStorage.clear()
            window.dispatchEvent(new Event("auth-changed"))
            this.$router.push("/")
        }
    },
    template: `
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
            <div class="container">
                <a class="navbar-brand fw-bold" href="#">Trekking App</a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navContent">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navContent">
                    <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                        <li class="nav-item" v-if="currentRole === 'admin'">
                            <router-link class="nav-link" to="/admin">Admin Dashboard</router-link>
                        </li>
                        <li class="nav-item" v-if="currentRole === 'staff'">
                            <router-link class="nav-link" to="/staff">Staff Dashboard</router-link>
                        </li>
                        <li class="nav-item" v-if="currentRole === 'trekker'">
                            <router-link class="nav-link" to="/trekker">Trekker Dashboard</router-link>
                        </li>
                    </ul>
                    <div class="d-flex align-items-center" v-if="currentRole">
                        <span class="text-light me-3 small">Logged in as: {{ userName }} ({{ currentRole }})</span>
                        <button class="btn btn-outline-danger btn-sm" @click="logoutUser">Logout</button>
                    </div>
                </div>
            </div>
        </nav>
    `
}
