Config = {}

Config.Command = 'jobcreator'
Config.AllowedGroups = { admin = true, superadmin = true }

-- Lavori che non possono essere eliminati dal menu
Config.ProtectedJobs = { unemployed = true, police = true, carabinieri = true, ambulance = true }
