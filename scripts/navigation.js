/**
 * Navigation controller for the Neuro-Clinic SPA dashboard.
 */
class Navigation {
    constructor() {
        this.navItems = document.querySelectorAll('.nav-item');
        this.views = {
            dashboard: document.getElementById('view-dashboard'),
            appointments: document.getElementById('view-appointments'),
            patients: document.getElementById('view-patients'),
            finance: document.getElementById('view-finance'),
            settings: document.getElementById('view-settings'),
            templates: document.getElementById('view-templates')
        };

        this.init();
    }

    init() {
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const view = item.getAttribute('data-view');
                if (view) {
                    e.preventDefault();
                    this.switchView(view);
                }
            });
        });
    }

    switchView(viewName) {
        // Update Nav Menu UI
        this.navItems.forEach(item => {
            if (item.getAttribute('data-view') === viewName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Toggle Views Visibility
        Object.keys(this.views).forEach(key => {
            if (key === viewName) {
                this.views[key].classList.remove('hidden');
                this.onViewOpen(viewName);
            } else {
                this.views[key].classList.add('hidden');
            }
        });
    }

    onViewOpen(viewName) {
        console.log(`View opened: ${viewName}`);
        if (!window.dashboardUI) {
            console.warn(`DashboardUI not ready for view: ${viewName}. Retrying in 100ms...`);
            setTimeout(() => this.onViewOpen(viewName), 100);
            return;
        }

        if (viewName === 'patients') {
            window.dashboardUI.renderPatientsManagement();
        } else if (viewName === 'finance') {
            window.dashboardUI.renderFinanceTable();
        } else if (viewName === 'dashboard') {
            window.dashboardUI.updateStats();
            window.dashboardUI.renderTodayAppointments();
        } else if (viewName === 'appointments') {
            window.dashboardUI.renderAllAppointments();
        } else if (viewName === 'settings') {
            window.dashboardUI.loadSettingsView();
        } else if (viewName === 'templates') {
            if (window.templatesUI) {
                window.templatesUI.renderTemplates();
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Wait a tiny bit to ensure DashboardUI is also ready
    setTimeout(() => {
        window.navigation = new Navigation();
    }, 100);
});
