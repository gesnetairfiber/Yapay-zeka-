"""
Mikrotik RouterOS API Client
Handles connection management and monitoring
"""

import requests
from typing import Dict, List, Optional
import logging
from urllib3.exceptions import InsecureRequestWarning

# Suppress SSL warnings for self-signed certificates
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

logger = logging.getLogger(__name__)

class MikrotikClient:
    def __init__(self, ip: str, username: str, password: str, port: int = 443):
        self.ip = ip
        self.base_url = f"https://{ip}:{port}/rest"
        self.auth = (username, password)
        self.session = requests.Session()
        self.session.verify = False  # Disable SSL verification for self-signed certs
        self.timeout = 10
    
    def test_connection(self) -> bool:
        """Test connection to Mikrotik router"""
        try:
            response = self.session.get(
                f"{self.base_url}/system/resource",
                auth=self.auth,
                timeout=self.timeout
            )
            response.raise_for_status()
            logger.info(f"Successfully connected to Mikrotik at {self.ip}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Mikrotik at {self.ip}: {e}")
            return False
    
    def get_pppoe_active_connections(self) -> List[Dict]:
        """
        Get list of active PPPoE connections
        
        Returns:
            list: List of active PPPoE sessions
        """
        try:
            response = self.session.get(
                f"{self.base_url}/ppp/active",
                auth=self.auth,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            sessions = response.json()
            logger.info(f"Retrieved {len(sessions)} active PPPoE sessions from {self.ip}")
            return sessions
            
        except Exception as e:
            logger.error(f"Error getting PPPoE sessions from {self.ip}: {e}")
            return []
    
    def get_hotspot_active_users(self) -> List[Dict]:
        """
        Get list of active Hotspot users
        
        Returns:
            list: List of active Hotspot sessions
        """
        try:
            response = self.session.get(
                f"{self.base_url}/ip/hotspot/active",
                auth=self.auth,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            sessions = response.json()
            logger.info(f"Retrieved {len(sessions)} active Hotspot sessions from {self.ip}")
            return sessions
            
        except Exception as e:
            logger.error(f"Error getting Hotspot sessions from {self.ip}: {e}")
            return []
    
    def disconnect_pppoe_user(self, username: str) -> bool:
        """
        Disconnect a PPPoE user by username
        
        Args:
            username: PPPoE username to disconnect
        
        Returns:
            bool: True if successful
        """
        try:
            # Get active sessions
            sessions = self.get_pppoe_active_connections()
            
            # Find user's session
            user_session = None
            for session in sessions:
                if session.get('name') == username:
                    user_session = session
                    break
            
            if not user_session:
                logger.warning(f"User {username} not found in active PPPoE sessions")
                return False
            
            session_id = user_session.get('.id')
            
            # Disconnect by removing the session
            response = self.session.delete(
                f"{self.base_url}/ppp/active/{session_id}",
                auth=self.auth,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            logger.info(f"Successfully disconnected PPPoE user {username}")
            return True
            
        except Exception as e:
            logger.error(f"Error disconnecting PPPoE user {username}: {e}")
            return False
    
    def disconnect_hotspot_user(self, username: str) -> bool:
        """
        Disconnect a Hotspot user by username
        
        Args:
            username: Hotspot username to disconnect
        
        Returns:
            bool: True if successful
        """
        try:
            # Get active sessions
            sessions = self.get_hotspot_active_users()
            
            # Find user's session
            user_session = None
            for session in sessions:
                if session.get('user') == username:
                    user_session = session
                    break
            
            if not user_session:
                logger.warning(f"User {username} not found in active Hotspot sessions")
                return False
            
            session_id = user_session.get('.id')
            
            # Disconnect by removing the session
            response = self.session.delete(
                f"{self.base_url}/ip/hotspot/active/{session_id}",
                auth=self.auth,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            logger.info(f"Successfully disconnected Hotspot user {username}")
            return True
            
        except Exception as e:
            logger.error(f"Error disconnecting Hotspot user {username}: {e}")
            return False
    
    def get_system_resources(self) -> Optional[Dict]:
        """
        Get router system resources (CPU, memory, uptime)
        
        Returns:
            dict: System resource information
        """
        try:
            response = self.session.get(
                f"{self.base_url}/system/resource",
                auth=self.auth,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            resources = response.json()
            logger.info(f"Retrieved system resources from {self.ip}")
            return resources
            
        except Exception as e:
            logger.error(f"Error getting system resources from {self.ip}: {e}")
            return None
    
    def get_interface_statistics(self, interface_name: str = "ether1") -> Optional[Dict]:
        """
        Get interface traffic statistics
        
        Args:
            interface_name: Name of the interface
        
        Returns:
            dict: Interface statistics
        """
        try:
            response = self.session.get(
                f"{self.base_url}/interface",
                auth=self.auth,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            interfaces = response.json()
            
            for interface in interfaces:
                if interface.get('name') == interface_name:
                    logger.info(f"Retrieved statistics for interface {interface_name}")
                    return interface
            
            logger.warning(f"Interface {interface_name} not found")
            return None
            
        except Exception as e:
            logger.error(f"Error getting interface statistics: {e}")
            return None
    
    def get_simple_queues(self) -> List[Dict]:
        """
        Get list of simple queues (bandwidth management)
        
        Returns:
            list: List of configured queues
        """
        try:
            response = self.session.get(
                f"{self.base_url}/queue/simple",
                auth=self.auth,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            queues = response.json()
            logger.info(f"Retrieved {len(queues)} queues from {self.ip}")
            return queues
            
        except Exception as e:
            logger.error(f"Error getting queues from {self.ip}: {e}")
            return []
    
    def create_simple_queue(self, name: str, target: str, max_limit: str) -> bool:
        """
        Create a simple queue for bandwidth management
        
        Args:
            name: Queue name
            target: Target IP address or network
            max_limit: Maximum bandwidth (e.g., "5M/10M")
        
        Returns:
            bool: True if successful
        """
        try:
            queue_data = {
                "name": name,
                "target": target,
                "max-limit": max_limit
            }
            
            response = self.session.put(
                f"{self.base_url}/queue/simple",
                auth=self.auth,
                json=queue_data,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            logger.info(f"Successfully created queue {name} for {target}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating queue {name}: {e}")
            return False
    
    def remove_simple_queue(self, queue_name: str) -> bool:
        """
        Remove a simple queue by name
        
        Args:
            queue_name: Name of the queue to remove
        
        Returns:
            bool: True if successful
        """
        try:
            # Get all queues
            queues = self.get_simple_queues()
            
            # Find queue by name
            queue_id = None
            for queue in queues:
                if queue.get('name') == queue_name:
                    queue_id = queue.get('.id')
                    break
            
            if not queue_id:
                logger.warning(f"Queue {queue_name} not found")
                return False
            
            # Delete the queue
            response = self.session.delete(
                f"{self.base_url}/queue/simple/{queue_id}",
                auth=self.auth,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            logger.info(f"Successfully removed queue {queue_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error removing queue {queue_name}: {e}")
            return False
