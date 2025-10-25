"""
RADIUS Client for FreeRADIUS MySQL Integration
Handles user creation, updates, and bandwidth management
"""

import mysql.connector
from typing import Optional, Dict, List
import logging

logger = logging.getLogger(__name__)

class RadiusClient:
    def __init__(self, host: str, user: str, password: str, database: str):
        self.config = {
            'host': host,
            'user': user,
            'password': password,
            'database': database,
            'autocommit': True
        }
    
    def _get_connection(self):
        """Get database connection"""
        try:
            return mysql.connector.connect(**self.config)
        except Exception as e:
            logger.error(f"Failed to connect to RADIUS database: {e}")
            return None
    
    def add_user(self, username: str, password: str, group: str = "default_users") -> bool:
        """
        Add user to RADIUS database
        
        Args:
            username: RADIUS username
            password: User password (stored as cleartext for Mikrotik compatibility)
            group: User group name (maps to bandwidth profiles)
        
        Returns:
            bool: True if successful, False otherwise
        """
        conn = self._get_connection()
        if not conn:
            return False
        
        try:
            cursor = conn.cursor()
            
            # Check if user already exists
            cursor.execute("SELECT username FROM radcheck WHERE username = %s", (username,))
            if cursor.fetchone():
                logger.warning(f"User {username} already exists in RADIUS")
                cursor.close()
                conn.close()
                return False
            
            # Insert into radcheck table (authentication)
            insert_check = """
                INSERT INTO radcheck (username, attribute, op, value) 
                VALUES (%s, 'Cleartext-Password', ':=', %s)
            """
            cursor.execute(insert_check, (username, password))
            
            # Insert into radusergroup table (group membership)
            insert_group = """
                INSERT INTO radusergroup (username, groupname, priority) 
                VALUES (%s, %s, 1)
            """
            cursor.execute(insert_group, (username, group))
            
            cursor.close()
            conn.close()
            
            logger.info(f"Successfully added user {username} to RADIUS with group {group}")
            return True
            
        except Exception as e:
            logger.error(f"Error adding RADIUS user {username}: {e}")
            if conn:
                conn.close()
            return False
    
    def update_user_password(self, username: str, new_password: str) -> bool:
        """Update user password in RADIUS"""
        conn = self._get_connection()
        if not conn:
            return False
        
        try:
            cursor = conn.cursor()
            
            update_query = """
                UPDATE radcheck 
                SET value = %s 
                WHERE username = %s AND attribute = 'Cleartext-Password'
            """
            cursor.execute(update_query, (new_password, username))
            
            affected_rows = cursor.rowcount
            cursor.close()
            conn.close()
            
            if affected_rows > 0:
                logger.info(f"Successfully updated password for {username}")
                return True
            else:
                logger.warning(f"No password found to update for {username}")
                return False
                
        except Exception as e:
            logger.error(f"Error updating password for {username}: {e}")
            if conn:
                conn.close()
            return False
    
    def update_user_group(self, username: str, new_group: str) -> bool:
        """
        Update user's RADIUS group (changes bandwidth profile)
        
        Args:
            username: RADIUS username
            new_group: New group name
        
        Returns:
            bool: True if successful
        """
        conn = self._get_connection()
        if not conn:
            return False
        
        try:
            cursor = conn.cursor()
            
            # Delete existing group
            cursor.execute("DELETE FROM radusergroup WHERE username = %s", (username,))
            
            # Insert new group
            insert_group = """
                INSERT INTO radusergroup (username, groupname, priority) 
                VALUES (%s, %s, 1)
            """
            cursor.execute(insert_group, (username, new_group))
            
            cursor.close()
            conn.close()
            
            logger.info(f"Successfully updated group for {username} to {new_group}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating group for {username}: {e}")
            if conn:
                conn.close()
            return False
    
    def set_bandwidth_limit(self, username: str, rate_limit: str) -> bool:
        """
        Set bandwidth limit for user via RADIUS reply attribute
        
        Args:
            username: RADIUS username
            rate_limit: Rate limit in format "upload/download" (e.g., "5M/10M")
        
        Returns:
            bool: True if successful
        """
        conn = self._get_connection()
        if not conn:
            return False
        
        try:
            cursor = conn.cursor()
            
            # Remove existing rate limit
            cursor.execute(
                "DELETE FROM radreply WHERE username = %s AND attribute = 'Mikrotik-Rate-Limit'",
                (username,)
            )
            
            # Insert new rate limit
            insert_reply = """
                INSERT INTO radreply (username, attribute, op, value) 
                VALUES (%s, 'Mikrotik-Rate-Limit', ':=', %s)
            """
            cursor.execute(insert_reply, (username, rate_limit))
            
            cursor.close()
            conn.close()
            
            logger.info(f"Successfully set bandwidth limit for {username}: {rate_limit}")
            return True
            
        except Exception as e:
            logger.error(f"Error setting bandwidth limit for {username}: {e}")
            if conn:
                conn.close()
            return False
    
    def delete_user(self, username: str) -> bool:
        """
        Delete user from RADIUS database
        
        Args:
            username: RADIUS username to delete
        
        Returns:
            bool: True if successful
        """
        conn = self._get_connection()
        if not conn:
            return False
        
        try:
            cursor = conn.cursor()
            
            # Delete from all RADIUS tables
            cursor.execute("DELETE FROM radcheck WHERE username = %s", (username,))
            cursor.execute("DELETE FROM radusergroup WHERE username = %s", (username,))
            cursor.execute("DELETE FROM radreply WHERE username = %s", (username,))
            
            cursor.close()
            conn.close()
            
            logger.info(f"Successfully deleted user {username} from RADIUS")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting RADIUS user {username}: {e}")
            if conn:
                conn.close()
            return False
    
    def get_user_accounting(self, username: str, days: int = 30) -> Optional[Dict]:
        """
        Get user accounting data (data usage, session time)
        
        Args:
            username: RADIUS username
            days: Number of days to retrieve data for
        
        Returns:
            dict: Accounting data or None if error
        """
        conn = self._get_connection()
        if not conn:
            return None
        
        try:
            cursor = conn.cursor(dictionary=True)
            
            query = """
                SELECT 
                    username,
                    SUM(acctinputoctets) as bytes_in,
                    SUM(acctoutputoctets) as bytes_out,
                    COUNT(*) as session_count,
                    SUM(acctsessiontime) as total_session_time
                FROM radacct
                WHERE username = %s 
                AND acctstarttime >= DATE_SUB(NOW(), INTERVAL %s DAY)
                GROUP BY username
            """
            
            cursor.execute(query, (username, days))
            result = cursor.fetchone()
            
            cursor.close()
            conn.close()
            
            if not result:
                return {
                    'username': username,
                    'bytes_in': 0,
                    'bytes_out': 0,
                    'session_count': 0,
                    'total_session_time': 0
                }
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting accounting data for {username}: {e}")
            if conn:
                conn.close()
            return None
    
    def get_active_sessions(self) -> List[Dict]:
        """
        Get all currently active sessions from radacct
        
        Returns:
            list: List of active session dictionaries
        """
        conn = self._get_connection()
        if not conn:
            return []
        
        try:
            cursor = conn.cursor(dictionary=True)
            
            query = """
                SELECT 
                    username,
                    acctstarttime,
                    acctinputoctets,
                    acctoutputoctets,
                    nasipaddress,
                    framedipaddress
                FROM radacct
                WHERE acctstoptime IS NULL
                ORDER BY acctstarttime DESC
            """
            
            cursor.execute(query)
            results = cursor.fetchall()
            
            cursor.close()
            conn.close()
            
            return results
            
        except Exception as e:
            logger.error(f"Error getting active sessions: {e}")
            if conn:
                conn.close()
            return []
    
    def create_bandwidth_group(self, group_name: str, download_limit: str, upload_limit: str) -> bool:
        """
        Create a bandwidth group with specified limits
        
        Args:
            group_name: Name of the group
            download_limit: Download limit (e.g., "10M")
            upload_limit: Upload limit (e.g., "5M")
        
        Returns:
            bool: True if successful
        """
        conn = self._get_connection()
        if not conn:
            return False
        
        try:
            cursor = conn.cursor()
            
            rate_limit = f"{upload_limit}/{download_limit}"
            
            # Insert into radgroupreply
            insert_reply = """
                INSERT INTO radgroupreply (groupname, attribute, op, value) 
                VALUES (%s, 'Mikrotik-Rate-Limit', ':=', %s)
            """
            cursor.execute(insert_reply, (group_name, rate_limit))
            
            cursor.close()
            conn.close()
            
            logger.info(f"Successfully created bandwidth group {group_name}: {rate_limit}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating bandwidth group {group_name}: {e}")
            if conn:
                conn.close()
            return False
